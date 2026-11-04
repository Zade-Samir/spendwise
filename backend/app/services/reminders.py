import datetime
import logging
import uuid
import zoneinfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction
from app.models.user import NotificationLog, User
from app.services.push_service import PushService

logger = logging.getLogger(__name__)


class ReminderService:
    @staticmethod
    async def evaluate_daily_reminders(
        session: AsyncSession,
        now_utc: datetime.datetime | None = None,
    ) -> int:
        """Evaluates daily expense logging reminders for all active users.

        Dispatches web push if:
        1. reminder_enabled is True.
        2. user local time >= reminder_time.
        3. user has 0 non-deleted transactions recorded for their local 'today'.
        4. no notification_log entry exists for ('daily_reminder', today_date_str).

        Returns the number of reminder notifications dispatched.
        """
        if now_utc is None:
            now_utc = datetime.datetime.now(datetime.UTC)
        elif now_utc.tzinfo is None:
            now_utc = now_utc.replace(tzinfo=datetime.UTC)

        stmt = select(User).where(User.reminder_enabled.is_(True))
        users = (await session.execute(stmt)).scalars().all()

        dispatched_count = 0

        for user in users:
            try:
                user_tz = zoneinfo.ZoneInfo(user.timezone or "Asia/Kolkata")
            except Exception:  # noqa: BLE001
                user_tz = zoneinfo.ZoneInfo("Asia/Kolkata")

            user_local_dt = now_utc.astimezone(user_tz)
            user_local_time = user_local_dt.time()

            # Condition 2: user local time >= reminder_time
            if user_local_time < user.reminder_time:
                continue

            user_today_date = user_local_dt.date()
            today_str = user_today_date.isoformat()

            # Condition 4: check notification_log for dedupe
            dedupe_stmt = select(NotificationLog).where(
                NotificationLog.user_id == user.id,
                NotificationLog.kind == "daily_reminder",
                NotificationLog.dedupe_key == today_str,
            )
            existing_log = (await session.execute(dedupe_stmt)).scalar_one_or_none()
            if existing_log:
                continue

            # Condition 3: user has 0 transactions today in their timezone
            start_of_day_local = datetime.datetime.combine(
                user_today_date, datetime.time.min, tzinfo=user_tz
            )
            end_of_day_local = start_of_day_local + datetime.timedelta(days=1)
            start_utc = start_of_day_local.astimezone(datetime.UTC)
            end_utc = end_of_day_local.astimezone(datetime.UTC)

            txn_count_stmt = select(func.count(Transaction.id)).where(
                Transaction.user_id == user.id,
                Transaction.deleted_at.is_(None),
                Transaction.occurred_at >= start_utc,
                Transaction.occurred_at < end_utc,
            )
            txn_count = (await session.execute(txn_count_stmt)).scalar_one() or 0

            if txn_count > 0:
                continue

            # Eligible! Send push notification
            sent, _ = await PushService.send_to_user(
                session=session,
                user_id=user.id,
                title="SpendWise",
                body="Spent anything today? Add your expenses (takes 10 seconds).",
                url="/add",
                tag="daily_reminder",
            )

            # Record in notification_log
            log_entry = NotificationLog(
                user_id=user.id,
                kind="daily_reminder",
                dedupe_key=today_str,
            )
            session.add(log_entry)
            await session.commit()
            dispatched_count += 1
            logger.info("Dispatched daily reminder to user %s (sent devices: %d)", user.id, sent)

        return dispatched_count

    @staticmethod
    async def check_budget_threshold_alert(
        session: AsyncSession,
        user_id: uuid.UUID,
        budget_id: uuid.UUID,
        budget_name: str,
        pct_used: float,
        period_start_str: str,
    ) -> bool:
        """Sends a budget alert if spending has crossed 80% or 100% threshold and has not yet been alerted for this cycle."""
        if pct_used >= 100:
            level = "100"
            body = (
                f"⚠️ Budget Exceeded: You've reached {int(pct_used)}% of your {budget_name} budget!"
            )
        elif pct_used >= 80:
            level = "80"
            body = f"⚠️ Budget Alert: You have used {int(pct_used)}% of your {budget_name} budget."
        else:
            return False

        dedupe_key = f"{budget_id}:{period_start_str}:{level}"
        stmt = select(NotificationLog).where(
            NotificationLog.user_id == user_id,
            NotificationLog.kind == "budget_threshold",
            NotificationLog.dedupe_key == dedupe_key,
        )
        if (await session.execute(stmt)).scalar_one_or_none():
            return False

        # Dispatch push
        await PushService.send_to_user(
            session=session,
            user_id=user_id,
            title="SpendWise Budget Alert",
            body=body,
            url="/budgets",
            tag=f"budget_{budget_id}",
        )

        # Log
        session.add(
            NotificationLog(
                user_id=user_id,
                kind="budget_threshold",
                dedupe_key=dedupe_key,
            )
        )
        await session.commit()
        return True
