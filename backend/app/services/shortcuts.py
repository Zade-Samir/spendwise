import datetime
import re
import uuid
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ValidationError
from app.models.category import Category
from app.models.enums import PaymentMethod, TxnSource
from app.models.transaction import Transaction
from app.schemas.shortcuts import ShortcutTransactionRequest, ShortcutTransactionResponse


def parse_shortcut_amount_minor(val: str | int | float) -> int:
    """Parses user-entered shortcut amount into integer paise (BIGINT minor)."""
    if isinstance(val, (int, float)):
        clean = str(val)
    else:
        clean = str(val).strip()

    # Strip currency symbols and commas
    clean = re.sub(r"(?i)(inr|rs\.?)", "", clean)
    clean = re.sub(r"[₹,\s]", "", clean).strip()

    if not clean:
        raise ValidationError("Amount is required and must be greater than 0")

    try:
        dec = Decimal(clean)
        if dec <= 0:
            raise ValidationError("Amount must be greater than 0")
        return int((dec * Decimal(100)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError(f"Invalid amount value: {val}") from exc


class ShortcutService:
    @staticmethod
    async def create_transaction(
        session: AsyncSession,
        user_id: uuid.UUID,
        payload: ShortcutTransactionRequest,
    ) -> ShortcutTransactionResponse:
        amount_minor = parse_shortcut_amount_minor(payload.amount)

        # 1. Resolve Category
        target_category: Category | None = None
        if payload.category:
            cat_query = payload.category.strip()

            # Try parsing as UUID
            try:
                cat_uuid = uuid.UUID(cat_query)
                stmt = select(Category).where(
                    or_(Category.user_id == user_id, Category.user_id.is_(None)),
                    Category.id == cat_uuid,
                    Category.archived_at.is_(None),
                )
                target_category = (await session.execute(stmt)).scalar_one_or_none()
            except ValueError:
                pass

            # If not found by UUID, try exact name match (case-insensitive)
            if not target_category:
                stmt = select(Category).where(
                    or_(Category.user_id == user_id, Category.user_id.is_(None)),
                    func.lower(Category.name) == func.lower(cat_query),
                    Category.archived_at.is_(None),
                )
                target_category = (await session.execute(stmt)).scalar_one_or_none()

            # If still not found, try partial match
            if not target_category:
                stmt = select(Category).where(
                    or_(Category.user_id == user_id, Category.user_id.is_(None)),
                    func.lower(Category.name).like(f"%{cat_query.lower()}%"),
                    Category.archived_at.is_(None),
                )
                target_category = (await session.execute(stmt)).scalars().first()

        # Fallback to user's first category if no match
        if not target_category:
            fallback_stmt = (
                select(Category)
                .where(
                    or_(Category.user_id == user_id, Category.user_id.is_(None)),
                    Category.archived_at.is_(None),
                )
                .order_by(Category.sort_order.asc())
            )
            target_category = (await session.execute(fallback_stmt)).scalars().first()
            if not target_category:
                raise ValidationError("No categories available for user")

        # 2. Resolve Payment Method
        pm_str = (payload.payment_method or "upi").lower().strip()
        pm_map = {
            "upi": PaymentMethod.UPI,
            "cash": PaymentMethod.CASH,
            "card": PaymentMethod.CARD,
            "credit card": PaymentMethod.CARD,
            "debit card": PaymentMethod.CARD,
            "netbanking": PaymentMethod.BANK_TRANSFER,
            "bank_transfer": PaymentMethod.BANK_TRANSFER,
            "other": PaymentMethod.OTHER,
        }
        payment_method = pm_map.get(pm_str, PaymentMethod.UPI)

        occurred_at = payload.occurred_at or datetime.datetime.now(datetime.UTC)
        if occurred_at.tzinfo is None:
            occurred_at = occurred_at.replace(tzinfo=datetime.UTC)

        merchant = payload.merchant.strip() if payload.merchant else None
        note = payload.note.strip() if payload.note else None
        description = note or merchant or target_category.name

        # 3. Create Transaction
        tx = Transaction(
            user_id=user_id,
            amount_minor=amount_minor,
            category_id=target_category.id,
            merchant=merchant,
            description=description,
            payment_method=payment_method,
            occurred_at=occurred_at,
            source=TxnSource.SHORTCUT,
        )
        session.add(tx)
        await session.commit()

        # Load category for response
        res_stmt = (
            select(Transaction)
            .options(selectinload(Transaction.category))
            .where(Transaction.id == tx.id)
        )
        saved_tx = (await session.execute(res_stmt)).scalar_one()

        return ShortcutTransactionResponse(
            id=saved_tx.id,
            amount_minor=saved_tx.amount_minor,
            merchant=saved_tx.merchant,
            category_name=saved_tx.category.name if saved_tx.category else target_category.name,
            payment_method=saved_tx.payment_method.value,
            note=note,
            occurred_at=saved_tx.occurred_at,
            source=saved_tx.source.value,
        )
