import datetime
import uuid
import zoneinfo
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.enums import PaymentMethod, TxnSource
from app.models.transaction import Transaction
from app.services.reminders import ReminderService


async def get_auth_token(client: AsyncClient, email: str) -> tuple[str, str]:
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Reminder User"},
    )
    assert reg.status_code == 201
    return reg.json()["access_token"], reg.json()["user"]["id"]


@pytest.mark.asyncio
async def test_user_settings_api(async_client: AsyncClient) -> None:
    token, _ = await get_auth_token(async_client, f"set_test_{uuid.uuid4().hex[:8]}@spendwise.app")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Get settings
    get_res = await async_client.get("/api/v1/settings", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["reminder_enabled"] is True
    assert data["reminder_time"] == "21:00"
    assert data["timezone"] == "Asia/Kolkata"

    # 2. Update settings
    patch_payload = {
        "reminder_time": "20:30",
        "timezone": "Asia/Kolkata",
        "theme": "dark",
    }
    patch_res = await async_client.patch("/api/v1/settings", headers=headers, json=patch_payload)
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["reminder_time"] == "20:30"
    assert updated["theme"] == "dark"


@pytest.mark.asyncio
async def test_daily_reminder_dispatch_and_deduplication(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    _, user_id_str = await get_auth_token(
        async_client, f"remind_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    user_id = uuid.UUID(user_id_str)

    tz = zoneinfo.ZoneInfo("Asia/Kolkata")
    # Virtual test time: 21:15 IST (past 21:00 reminder time)
    test_dt = datetime.datetime(2026, 11, 4, 21, 15, 0, tzinfo=tz)
    now_utc = test_dt.astimezone(datetime.UTC)

    # 1. Run evaluation with 0 transactions logged -> should dispatch 1 reminder
    with patch("app.services.push_service.webpush", return_value=MagicMock()):
        count_1 = await ReminderService.evaluate_daily_reminders(db_session, now_utc=now_utc)
        assert count_1 >= 1

        from app.models.user import NotificationLog

        log_stmt = select(NotificationLog).where(
            NotificationLog.user_id == user_id,
            NotificationLog.kind == "daily_reminder",
        )
        log = (await db_session.execute(log_stmt)).scalar_one_or_none()
        assert log is not None

        # 2. Run evaluation again at the same day -> deduplication must prevent second dispatch
        count_2 = await ReminderService.evaluate_daily_reminders(db_session, now_utc=now_utc)
        assert count_2 == 0


@pytest.mark.asyncio
async def test_daily_reminder_skipped_if_transactions_exist(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    token, user_id_str = await get_auth_token(
        async_client, f"remind_skip_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    user_id = uuid.UUID(user_id_str)

    cat = (await db_session.execute(select(Category))).scalars().first()
    assert cat is not None

    # Log a transaction earlier today at 14:00 IST
    tz = zoneinfo.ZoneInfo("Asia/Kolkata")
    today_date = datetime.date(2026, 11, 5)
    tx_dt = datetime.datetime.combine(today_date, datetime.time(14, 0), tzinfo=tz).astimezone(datetime.UTC)

    tx = Transaction(
        user_id=user_id,
        amount_minor=12000,
        category_id=cat.id,
        description="Lunch",
        payment_method=PaymentMethod.UPI,
        occurred_at=tx_dt,
        source=TxnSource.MANUAL,
    )
    db_session.add(tx)
    await db_session.commit()

    # Virtual clock at 21:30 IST on the same day
    now_dt = datetime.datetime.combine(today_date, datetime.time(21, 30), tzinfo=tz).astimezone(datetime.UTC)

    # Run evaluation -> since transaction exists, must NOT dispatch reminder for this user
    with patch("app.services.push_service.webpush", return_value=MagicMock()):
        await ReminderService.evaluate_daily_reminders(db_session, now_utc=now_dt)

        from app.models.user import NotificationLog

        log_stmt = select(NotificationLog).where(
            NotificationLog.user_id == user_id,
            NotificationLog.kind == "daily_reminder",
            NotificationLog.dedupe_key == today_date.isoformat(),
        )
        log = (await db_session.execute(log_stmt)).scalar_one_or_none()
        assert log is None, "Reminder should NOT have been sent when transactions exist today"
