import calendar
import datetime
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError, ValidationError
from app.models.category import Category
from app.models.enums import RecurFreq, RecurMode, TxnSource
from app.models.recurring import RecurringRule
from app.models.transaction import Transaction
from app.schemas.recurring import (
    RecurringConfirmRequest,
    RecurringRuleCreateRequest,
    RecurringRuleResponse,
    RecurringRuleUpdateRequest,
)
from app.schemas.transaction import TransactionCategoryBrief, TransactionSubcategoryBrief


def compute_next_due_date(
    frequency: RecurFreq,
    interval_count: int,
    current_due: datetime.date,
    day_of_month: int | None = None,
    day_of_week: int | None = None,
) -> datetime.date:
    """Computes the next due date with strict month-end calendar day clamping per spec §4.1.

    Clamping rules:
    - Day 31 in February evaluates to Feb 28 (or Feb 29 in leap years).
    - Day 31 in April evaluates to Apr 30.
    """
    if interval_count <= 0:
        interval_count = 1

    if frequency == RecurFreq.DAILY:
        return current_due + datetime.timedelta(days=interval_count)

    elif frequency == RecurFreq.WEEKLY:
        return current_due + datetime.timedelta(weeks=interval_count)

    elif frequency == RecurFreq.MONTHLY:
        target_day = day_of_month if day_of_month is not None else current_due.day

        total_months = current_due.month - 1 + interval_count
        new_year = current_due.year + total_months // 12
        new_month = total_months % 12 + 1

        # Month-end day clamping
        _, max_days = calendar.monthrange(new_year, new_month)
        clamped_day = min(target_day, max_days)

        return datetime.date(new_year, new_month, clamped_day)

    elif frequency == RecurFreq.YEARLY:
        new_year = current_due.year + interval_count
        target_month = current_due.month
        target_day = day_of_month if day_of_month is not None else current_due.day

        _, max_days = calendar.monthrange(new_year, target_month)
        clamped_day = min(target_day, max_days)
        return datetime.date(new_year, target_month, clamped_day)

    return current_due + datetime.timedelta(days=30)


class RecurringService:
    @staticmethod
    async def create_rule(
        session: AsyncSession,
        user_id: uuid.UUID,
        payload: RecurringRuleCreateRequest,
    ) -> RecurringRuleResponse:
        """Creates a recurring rule with category validation and initial next_due_date calculation."""
        # 1. Validate category
        cat_stmt = select(Category).where(
            Category.user_id == user_id, Category.id == payload.category_id
        )
        cat = (await session.execute(cat_stmt)).scalar_one_or_none()
        if not cat:
            raise ValidationError("Invalid category selection")

        subcat = None
        if payload.subcategory_id:
            subcat_stmt = select(Category).where(
                Category.user_id == user_id, Category.id == payload.subcategory_id
            )
            subcat = (await session.execute(subcat_stmt)).scalar_one_or_none()
            if not subcat or subcat.parent_id != payload.category_id:
                raise ValidationError("Invalid subcategory for chosen category")

        # 2. Determine initial next_due_date
        next_due = payload.start_date
        if payload.day_of_month and payload.frequency == RecurFreq.MONTHLY:
            _, max_days = calendar.monthrange(next_due.year, next_due.month)
            clamped = min(payload.day_of_month, max_days)
            next_due = datetime.date(next_due.year, next_due.month, clamped)
            if next_due < payload.start_date:
                # Advance to next cycle
                next_due = compute_next_due_date(
                    frequency=payload.frequency,
                    interval_count=payload.interval_count,
                    current_due=next_due,
                    day_of_month=payload.day_of_month,
                )

        rule = RecurringRule(
            user_id=user_id,
            name=payload.name.strip(),
            amount_minor=payload.amount_minor,
            category_id=payload.category_id,
            subcategory_id=payload.subcategory_id,
            merchant=payload.merchant.strip() if payload.merchant else None,
            payment_method=payload.payment_method,
            frequency=payload.frequency,
            interval_count=payload.interval_count,
            day_of_month=payload.day_of_month,
            day_of_week=payload.day_of_week,
            start_date=payload.start_date,
            end_date=payload.end_date,
            next_due_date=next_due,
            mode=payload.mode,
            active=True,
        )
        session.add(rule)
        await session.commit()
        await session.refresh(rule, ["category", "subcategory"])

        return RecurringService._to_response(rule)

    @staticmethod
    async def list_rules(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[RecurringRuleResponse]:
        """Lists all recurring rules for the authenticated user."""
        stmt = (
            select(RecurringRule)
            .options(selectinload(RecurringRule.category), selectinload(RecurringRule.subcategory))
            .where(RecurringRule.user_id == user_id)
            .order_by(RecurringRule.active.desc(), RecurringRule.next_due_date.asc())
        )
        res = await session.execute(stmt)
        return [RecurringService._to_response(r) for r in res.scalars().all()]

    @staticmethod
    async def get_due_rules(
        session: AsyncSession,
        user_id: uuid.UUID,
        today_date: datetime.date | None = None,
    ) -> list[RecurringRuleResponse]:
        """Returns recurring rules in 'remind' mode where next_due_date <= today."""
        if not today_date:
            today_date = datetime.datetime.now(datetime.UTC).date()

        stmt = (
            select(RecurringRule)
            .options(selectinload(RecurringRule.category), selectinload(RecurringRule.subcategory))
            .where(
                RecurringRule.user_id == user_id,
                RecurringRule.active.is_(True),
                RecurringRule.mode == RecurMode.REMIND,
                RecurringRule.next_due_date <= today_date,
            )
            .order_by(RecurringRule.next_due_date.asc())
        )
        res = await session.execute(stmt)
        return [RecurringService._to_response(r) for r in res.scalars().all()]

    @staticmethod
    async def update_rule(
        session: AsyncSession,
        user_id: uuid.UUID,
        rule_id: uuid.UUID,
        payload: RecurringRuleUpdateRequest,
    ) -> RecurringRuleResponse:
        """Updates a recurring rule with partial fields."""
        stmt = (
            select(RecurringRule)
            .options(selectinload(RecurringRule.category), selectinload(RecurringRule.subcategory))
            .where(RecurringRule.user_id == user_id, RecurringRule.id == rule_id)
        )
        rule = (await session.execute(stmt)).scalar_one_or_none()
        if not rule:
            raise NotFoundError("Recurring rule not found")

        if payload.name is not None:
            rule.name = payload.name.strip()
        if payload.amount_minor is not None:
            rule.amount_minor = payload.amount_minor
        if payload.category_id is not None:
            rule.category_id = payload.category_id
        if payload.subcategory_id is not None:
            rule.subcategory_id = payload.subcategory_id
        if payload.merchant is not None:
            rule.merchant = payload.merchant.strip() if payload.merchant else None
        if payload.payment_method is not None:
            rule.payment_method = payload.payment_method
        if payload.frequency is not None:
            rule.frequency = payload.frequency
        if payload.interval_count is not None:
            rule.interval_count = payload.interval_count
        if payload.day_of_month is not None:
            rule.day_of_month = payload.day_of_month
        if payload.day_of_week is not None:
            rule.day_of_week = payload.day_of_week
        if payload.start_date is not None:
            rule.start_date = payload.start_date
        if payload.end_date is not None:
            rule.end_date = payload.end_date
        if payload.mode is not None:
            rule.mode = payload.mode
        if payload.active is not None:
            rule.active = payload.active

        await session.commit()
        await session.refresh(rule, ["category", "subcategory"])
        return RecurringService._to_response(rule)

    @staticmethod
    async def delete_rule(
        session: AsyncSession,
        user_id: uuid.UUID,
        rule_id: uuid.UUID,
    ) -> None:
        """Deletes a recurring rule."""
        stmt = select(RecurringRule).where(
            RecurringRule.user_id == user_id, RecurringRule.id == rule_id
        )
        rule = (await session.execute(stmt)).scalar_one_or_none()
        if not rule:
            raise NotFoundError("Recurring rule not found")

        await session.delete(rule)
        await session.commit()

    @staticmethod
    async def confirm_rule(
        session: AsyncSession,
        user_id: uuid.UUID,
        rule_id: uuid.UUID,
        payload: RecurringConfirmRequest,
    ) -> Transaction:
        """Confirms payment for a recurring rule cycle, creates a transaction, and advances next_due_date."""
        stmt = (
            select(RecurringRule)
            .options(selectinload(RecurringRule.category), selectinload(RecurringRule.subcategory))
            .where(RecurringRule.user_id == user_id, RecurringRule.id == rule_id)
        )
        rule = (await session.execute(stmt)).scalar_one_or_none()
        if not rule:
            raise NotFoundError("Recurring rule not found")

        amount_minor = payload.amount_minor or rule.amount_minor
        occurred_at = payload.occurred_at or datetime.datetime.now(datetime.UTC)

        # Idempotent client_id using rule.id and due date
        iso_due = rule.next_due_date.isoformat()
        client_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"{rule.id}:{iso_due}")

        # Insert Transaction
        tx = Transaction(
            user_id=user_id,
            amount_minor=amount_minor,
            category_id=rule.category_id,
            subcategory_id=rule.subcategory_id,
            merchant=rule.merchant or rule.name,
            description=f"Recurring: {rule.name}",
            payment_method=rule.payment_method,
            occurred_at=occurred_at,
            source=TxnSource.RECURRING,
            client_id=client_id,
            recurring_rule_id=rule.id,
        )
        session.add(tx)

        # Advance next_due_date
        next_due = compute_next_due_date(
            frequency=rule.frequency,
            interval_count=rule.interval_count,
            current_due=rule.next_due_date,
            day_of_month=rule.day_of_month,
            day_of_week=rule.day_of_week,
        )

        if rule.end_date and next_due > rule.end_date:
            rule.active = False

        rule.next_due_date = next_due
        await session.commit()
        stmt_tx = (
            select(Transaction)
            .options(selectinload(Transaction.category), selectinload(Transaction.subcategory))
            .where(Transaction.id == tx.id)
        )
        saved_tx = (await session.execute(stmt_tx)).scalar_one()
        return saved_tx

    @staticmethod
    async def skip_rule(
        session: AsyncSession,
        user_id: uuid.UUID,
        rule_id: uuid.UUID,
    ) -> RecurringRuleResponse:
        """Skips the current cycle without creating a transaction, advancing next_due_date."""
        stmt = (
            select(RecurringRule)
            .options(selectinload(RecurringRule.category), selectinload(RecurringRule.subcategory))
            .where(RecurringRule.user_id == user_id, RecurringRule.id == rule_id)
        )
        rule = (await session.execute(stmt)).scalar_one_or_none()
        if not rule:
            raise NotFoundError("Recurring rule not found")

        next_due = compute_next_due_date(
            frequency=rule.frequency,
            interval_count=rule.interval_count,
            current_due=rule.next_due_date,
            day_of_month=rule.day_of_month,
            day_of_week=rule.day_of_week,
        )

        if rule.end_date and next_due > rule.end_date:
            rule.active = False

        rule.next_due_date = next_due
        await session.commit()
        stmt_rule = (
            select(RecurringRule)
            .options(selectinload(RecurringRule.category), selectinload(RecurringRule.subcategory))
            .where(RecurringRule.id == rule.id)
        )
        saved_rule = (await session.execute(stmt_rule)).scalar_one()
        return RecurringService._to_response(saved_rule)

    @staticmethod
    async def process_auto_create_rules(
        session: AsyncSession,
        today_date: datetime.date | None = None,
    ) -> int:
        """Executes catch-up loop for rules in 'auto_create' mode where next_due_date <= today.

        Uses client_id = uuid5(rule.id, iso_due_date) for guaranteed idempotency.
        Capped at 12 cycles per rule per run to prevent runaway loops.
        """
        if not today_date:
            today_date = datetime.datetime.now(datetime.UTC).date()

        stmt = select(RecurringRule).where(
            RecurringRule.active.is_(True),
            RecurringRule.mode == RecurMode.AUTO_CREATE,
            RecurringRule.next_due_date <= today_date,
        )
        res = await session.execute(stmt)
        due_rules = res.scalars().all()

        created_count = 0

        for rule in due_rules:
            cycles = 0
            while rule.next_due_date <= today_date and cycles < 12 and rule.active:
                iso_due = rule.next_due_date.isoformat()
                client_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"{rule.id}:{iso_due}")

                # Check if already created
                existing_stmt = select(Transaction).where(
                    Transaction.user_id == rule.user_id,
                    Transaction.client_id == client_id,
                )
                existing = (await session.execute(existing_stmt)).scalar_one_or_none()

                if not existing:
                    tx_time = datetime.datetime.combine(
                        rule.next_due_date,
                        datetime.time(9, 0),
                        tzinfo=datetime.UTC,
                    )
                    tx = Transaction(
                        user_id=rule.user_id,
                        amount_minor=rule.amount_minor,
                        category_id=rule.category_id,
                        subcategory_id=rule.subcategory_id,
                        merchant=rule.merchant or rule.name,
                        description=f"Auto Recurring: {rule.name}",
                        payment_method=rule.payment_method,
                        occurred_at=tx_time,
                        source=TxnSource.RECURRING,
                        client_id=client_id,
                        recurring_rule_id=rule.id,
                    )
                    session.add(tx)
                    created_count += 1

                # Advance next_due_date
                next_due = compute_next_due_date(
                    frequency=rule.frequency,
                    interval_count=rule.interval_count,
                    current_due=rule.next_due_date,
                    day_of_month=rule.day_of_month,
                    day_of_week=rule.day_of_week,
                )

                if rule.end_date and next_due > rule.end_date:
                    rule.active = False

                rule.next_due_date = next_due
                cycles += 1

        if due_rules:
            await session.commit()

        return created_count

    @staticmethod
    def _to_response(rule: RecurringRule) -> RecurringRuleResponse:
        cat_ref = None
        if rule.category:
            cat_ref = TransactionCategoryBrief(
                id=rule.category.id,
                name=rule.category.name,
                icon=rule.category.icon,
                color=rule.category.color,
            )
        subcat_ref = None
        if rule.subcategory:
            subcat_ref = TransactionSubcategoryBrief(
                id=rule.subcategory.id,
                name=rule.subcategory.name,
            )

        return RecurringRuleResponse(
            id=rule.id,
            name=rule.name,
            amount_minor=rule.amount_minor,
            category_id=rule.category_id,
            subcategory_id=rule.subcategory_id,
            category=cat_ref,
            subcategory=subcat_ref,
            merchant=rule.merchant,
            payment_method=rule.payment_method,
            frequency=rule.frequency,
            interval_count=rule.interval_count,
            day_of_month=rule.day_of_month,
            day_of_week=rule.day_of_week,
            start_date=rule.start_date,
            end_date=rule.end_date,
            next_due_date=rule.next_due_date,
            mode=rule.mode,
            active=rule.active,
            created_at=rule.created_at,
            updated_at=rule.updated_at,
        )
