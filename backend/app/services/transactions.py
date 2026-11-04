import base64
import datetime
import hashlib
import json
import uuid
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import NotFoundError, ValidationError
from app.models.category import Category, CategoryRule
from app.models.enums import PaymentMethod, TxnSource
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import (
    RecentMerchantItem,
    TransactionCreateRequest,
    TransactionListResponse,
    TransactionTotals,
    TransactionUpdateRequest,
)
from app.services.budgets import check_budget_alerts


def compute_dedupe_hash(
    user_id: uuid.UUID,
    amount_minor: int,
    category_id: uuid.UUID,
    merchant: str | None,
    occurred_at: datetime.datetime,
) -> str:
    """Computes a SHA-256 deduplication fingerprint for a transaction."""
    date_str = occurred_at.strftime("%Y-%m-%d")
    clean_merchant = (merchant or "").strip().lower()
    raw = f"{user_id}:{amount_minor}:{category_id}:{clean_merchant}:{date_str}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def create_transaction(
    session: AsyncSession,
    user_id: uuid.UUID,
    payload: TransactionCreateRequest,
) -> tuple[Transaction, bool]:
    """Creates a transaction record with idempotency check, date validation, and merchant rule learning."""
    now_utc = datetime.datetime.now(datetime.UTC)

    # 1. Idempotency Check via client_id
    if payload.client_id is not None:
        client_query = (
            select(Transaction)
            .options(selectinload(Transaction.category), selectinload(Transaction.subcategory))
            .where(Transaction.user_id == user_id, Transaction.client_id == payload.client_id)
        )
        existing_res = await session.execute(client_query)
        existing_tx = existing_res.scalar_one_or_none()
        if existing_tx:
            return existing_tx, False

    # 2. Amount and Date Validation
    if payload.amount_minor <= 0:
        raise ValidationError("Amount must be greater than 0")
    if payload.amount_minor > 1_000_000_000:
        raise ValidationError("Amount exceeds maximum limit of ₹10,00,00,000")

    occurred_at = payload.occurred_at or now_utc
    if occurred_at > now_utc + datetime.timedelta(minutes=5):
        raise ValidationError("Transaction date cannot be in the future")

    # 3. Category & Subcategory Validation
    cat_stmt = select(Category).where(
        Category.user_id == user_id, Category.id == payload.category_id
    )
    cat_res = await session.execute(cat_stmt)
    category = cat_res.scalar_one_or_none()
    if not category:
        raise ValidationError("Invalid category selection")

    subcategory = None
    if payload.subcategory_id is not None:
        subcat_stmt = select(Category).where(
            Category.user_id == user_id, Category.id == payload.subcategory_id
        )
        subcat_res = await session.execute(subcat_stmt)
        subcategory = subcat_res.scalar_one_or_none()
        if not subcategory or subcategory.parent_id != payload.category_id:
            raise ValidationError("Invalid subcategory selection for chosen category")

    dedupe_hash = compute_dedupe_hash(
        user_id=user_id,
        amount_minor=payload.amount_minor,
        category_id=payload.category_id,
        merchant=payload.merchant,
        occurred_at=occurred_at,
    )

    tx = Transaction(
        user_id=user_id,
        amount_minor=payload.amount_minor,
        category_id=payload.category_id,
        subcategory_id=payload.subcategory_id,
        merchant=payload.merchant.strip() if payload.merchant else None,
        description=payload.description.strip() if payload.description else None,
        notes=payload.notes.strip() if payload.notes else None,
        payment_method=payload.payment_method,
        occurred_at=occurred_at,
        source=payload.source,
        client_id=payload.client_id,
        dedupe_hash=dedupe_hash,
    )
    session.add(tx)
    await session.flush()

    # 4. Auto-learn classification rule for novel merchant
    if tx.merchant and len(tx.merchant.strip()) >= 3:
        clean_m = tx.merchant.strip().lower()
        existing_rule_stmt = select(CategoryRule).where(
            CategoryRule.user_id == user_id,
            func.lower(CategoryRule.pattern) == clean_m,
        )
        existing_rule_res = await session.execute(existing_rule_stmt)
        if existing_rule_res.scalar_one_or_none() is None:
            new_rule = CategoryRule(
                user_id=user_id,
                pattern=clean_m,
                category_id=tx.category_id,
                subcategory_id=tx.subcategory_id,
                priority=0,
                source="learned",
            )
            session.add(new_rule)

    await session.commit()

    # Trigger budget threshold evaluation
    user_obj = await session.get(User, user_id)
    if user_obj:
        await check_budget_alerts(session, user_obj)

    # Refresh with relationships loaded
    load_stmt = (
        select(Transaction)
        .options(selectinload(Transaction.category), selectinload(Transaction.subcategory))
        .where(Transaction.id == tx.id)
    )
    reloaded_tx = (await session.execute(load_stmt)).scalar_one()

    return reloaded_tx, True


def encode_cursor(occurred_at: datetime.datetime, tx_id: uuid.UUID) -> str:
    """Encodes cursor tuple (occurred_at, id) as base64 string."""
    data = {"t": occurred_at.isoformat(), "id": str(tx_id)}
    json_bytes = json.dumps(data).encode("utf-8")
    return base64.urlsafe_b64encode(json_bytes).decode("utf-8")


def decode_cursor(cursor_str: str) -> tuple[datetime.datetime, uuid.UUID] | None:
    """Decodes cursor string to (occurred_at, id)."""
    try:
        json_bytes = base64.urlsafe_b64decode(cursor_str.encode("utf-8"))
        data = json.loads(json_bytes.decode("utf-8"))
        occurred_at = datetime.datetime.fromisoformat(data["t"])
        tx_id = uuid.UUID(data["id"])
        return occurred_at, tx_id
    except Exception:
        return None


async def list_transactions(
    session: AsyncSession,
    user_id: uuid.UUID,
    user_tz: ZoneInfo,
    q: str | None = None,
    from_date: datetime.date | None = None,
    to_date: datetime.date | None = None,
    category_id: uuid.UUID | None = None,
    subcategory_id: uuid.UUID | None = None,
    payment_methods: list[PaymentMethod] | None = None,
    min_amount_minor: int | None = None,
    max_amount_minor: int | None = None,
    source: TxnSource | None = None,
    sort: str = "date_desc",
    cursor: str | None = None,
    limit: int = 50,
) -> TransactionListResponse:
    """Fetches paginated transaction records matching filters with cursor navigation and totals."""
    limit = max(1, min(limit, 200))

    # Base filters
    filters = [
        Transaction.user_id == user_id,
        Transaction.deleted_at.is_(None),
    ]

    # Search filter (trigram / ILIKE on merchant, description, notes)
    if q and q.strip():
        search_term = f"%{q.strip().lower()}%"
        filters.append(
            or_(
                func.lower(func.coalesce(Transaction.merchant, "")).like(search_term),
                func.lower(func.coalesce(Transaction.description, "")).like(search_term),
                func.lower(func.coalesce(Transaction.notes, "")).like(search_term),
            )
        )

    # Date range filters evaluated in user timezone
    if from_date is not None:
        start_dt = datetime.datetime.combine(
            from_date, datetime.time.min, tzinfo=user_tz
        ).astimezone(datetime.UTC)
        filters.append(Transaction.occurred_at >= start_dt)

    if to_date is not None:
        end_dt = datetime.datetime.combine(to_date, datetime.time.max, tzinfo=user_tz).astimezone(
            datetime.UTC
        )
        filters.append(Transaction.occurred_at <= end_dt)

    if category_id is not None:
        filters.append(Transaction.category_id == category_id)

    if subcategory_id is not None:
        filters.append(Transaction.subcategory_id == subcategory_id)

    if payment_methods:
        filters.append(Transaction.payment_method.in_(payment_methods))

    if min_amount_minor is not None:
        filters.append(Transaction.amount_minor >= min_amount_minor)

    if max_amount_minor is not None:
        filters.append(Transaction.amount_minor <= max_amount_minor)

    if source is not None:
        filters.append(Transaction.source == source)

    # Calculate aggregate totals for this filter set
    totals_stmt = select(
        func.count().label("count"),
        func.coalesce(func.sum(Transaction.amount_minor), 0).label("sum_minor"),
    ).where(*filters)
    totals_res = await session.execute(totals_stmt)
    total_row = totals_res.one()
    total_count = int(total_row[0])
    total_sum_minor = int(total_row[1])

    # Cursor filter
    if cursor:
        cursor_data = decode_cursor(cursor)
        if cursor_data:
            c_time, c_id = cursor_data
            if sort == "date_asc":
                filters.append(
                    or_(
                        Transaction.occurred_at > c_time,
                        (Transaction.occurred_at == c_time) & (Transaction.id > c_id),
                    )
                )
            else:  # default date_desc
                filters.append(
                    or_(
                        Transaction.occurred_at < c_time,
                        (Transaction.occurred_at == c_time) & (Transaction.id < c_id),
                    )
                )

    # Sorting
    order_by_clauses: list[Any] = []
    if sort == "date_asc":
        order_by_clauses = [Transaction.occurred_at.asc(), Transaction.id.asc()]
    elif sort == "amount_desc":
        order_by_clauses = [
            Transaction.amount_minor.desc(),
            Transaction.occurred_at.desc(),
            Transaction.id.desc(),
        ]
    elif sort == "amount_asc":
        order_by_clauses = [
            Transaction.amount_minor.asc(),
            Transaction.occurred_at.asc(),
            Transaction.id.asc(),
        ]
    else:  # default date_desc
        order_by_clauses = [Transaction.occurred_at.desc(), Transaction.id.desc()]

    query = (
        select(Transaction)
        .options(selectinload(Transaction.category), selectinload(Transaction.subcategory))
        .where(*filters)
        .order_by(*order_by_clauses)
        .limit(limit + 1)
    )

    res = await session.execute(query)
    rows = list(res.scalars().all())

    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        last_item = rows[-1]
        next_cursor = encode_cursor(last_item.occurred_at, last_item.id)

    return TransactionListResponse(
        items=rows,  # type: ignore[arg-type]
        next_cursor=next_cursor,
        totals=TransactionTotals(
            count=total_count,
            sum_minor=total_sum_minor,
        ),
    )


async def get_transaction_by_id(
    session: AsyncSession,
    user_id: uuid.UUID,
    transaction_id: uuid.UUID,
) -> Transaction:
    """Fetches transaction by ID ensuring user isolation and active status."""
    stmt = (
        select(Transaction)
        .options(selectinload(Transaction.category), selectinload(Transaction.subcategory))
        .where(
            Transaction.user_id == user_id,
            Transaction.id == transaction_id,
            Transaction.deleted_at.is_(None),
        )
    )
    res = await session.execute(stmt)
    tx = res.scalar_one_or_none()
    if not tx:
        raise NotFoundError("Transaction not found")
    return tx


async def update_transaction(
    session: AsyncSession,
    user_id: uuid.UUID,
    transaction_id: uuid.UUID,
    payload: TransactionUpdateRequest,
) -> Transaction:
    """Updates transaction fields while preserving financial integrity and user isolation."""
    tx = await get_transaction_by_id(session, user_id, transaction_id)
    now_utc = datetime.datetime.now(datetime.UTC)

    if payload.amount_minor is not None:
        if payload.amount_minor <= 0:
            raise ValidationError("Amount must be greater than 0")
        if payload.amount_minor > 1_000_000_000:
            raise ValidationError("Amount exceeds maximum limit of ₹10,00,00,000")
        tx.amount_minor = payload.amount_minor

    if payload.category_id is not None:
        cat_stmt = select(Category).where(
            Category.user_id == user_id, Category.id == payload.category_id
        )
        cat_res = await session.execute(cat_stmt)
        category = cat_res.scalar_one_or_none()
        if not category:
            raise ValidationError("Invalid category selection")
        tx.category_id = payload.category_id

    if payload.subcategory_id is not None:
        subcat_stmt = select(Category).where(
            Category.user_id == user_id, Category.id == payload.subcategory_id
        )
        subcat_res = await session.execute(subcat_stmt)
        subcategory = subcat_res.scalar_one_or_none()
        if not subcategory or subcategory.parent_id != tx.category_id:
            raise ValidationError("Invalid subcategory selection for chosen category")
        tx.subcategory_id = payload.subcategory_id

    if payload.merchant is not None:
        tx.merchant = payload.merchant.strip() if payload.merchant else None
    if payload.description is not None:
        tx.description = payload.description.strip() if payload.description else None
    if payload.notes is not None:
        tx.notes = payload.notes.strip() if payload.notes else None
    if payload.payment_method is not None:
        tx.payment_method = payload.payment_method

    if payload.occurred_at is not None:
        if payload.occurred_at > now_utc + datetime.timedelta(minutes=5):
            raise ValidationError("Transaction date cannot be in the future")
        tx.occurred_at = payload.occurred_at

    tx.dedupe_hash = compute_dedupe_hash(
        user_id=user_id,
        amount_minor=tx.amount_minor,
        category_id=tx.category_id,
        merchant=tx.merchant,
        occurred_at=tx.occurred_at,
    )

    await session.commit()

    user_obj = await session.get(User, user_id)
    if user_obj:
        await check_budget_alerts(session, user_obj)

    # Reload relationships
    load_stmt = (
        select(Transaction)
        .options(selectinload(Transaction.category), selectinload(Transaction.subcategory))
        .where(Transaction.id == tx.id)
    )
    return (await session.execute(load_stmt)).scalar_one()


async def soft_delete_transaction(
    session: AsyncSession,
    user_id: uuid.UUID,
    transaction_id: uuid.UUID,
) -> None:
    """Soft-deletes a transaction setting deleted_at = now()."""
    tx = await get_transaction_by_id(session, user_id, transaction_id)
    tx.deleted_at = datetime.datetime.now(datetime.UTC)
    await session.commit()

    user_obj = await session.get(User, user_id)
    if user_obj:
        await check_budget_alerts(session, user_obj)


async def restore_transaction(
    session: AsyncSession,
    user_id: uuid.UUID,
    transaction_id: uuid.UUID,
) -> Transaction:
    """Restores a soft-deleted transaction (used by the Undo action)."""
    stmt = (
        select(Transaction)
        .options(selectinload(Transaction.category), selectinload(Transaction.subcategory))
        .where(Transaction.user_id == user_id, Transaction.id == transaction_id)
    )
    res = await session.execute(stmt)
    tx = res.scalar_one_or_none()
    if not tx:
        raise NotFoundError("Transaction not found")

    tx.deleted_at = None
    await session.commit()

    user_obj = await session.get(User, user_id)
    if user_obj:
        await check_budget_alerts(session, user_obj)

    await session.refresh(tx)
    return tx


async def bulk_soft_delete(
    session: AsyncSession,
    user_id: uuid.UUID,
    transaction_ids: list[uuid.UUID],
) -> int:
    """Soft-deletes multiple transactions simultaneously."""
    now = datetime.datetime.now(datetime.UTC)
    stmt = (
        update(Transaction)
        .where(
            Transaction.user_id == user_id,
            Transaction.id.in_(transaction_ids),
            Transaction.deleted_at.is_(None),
        )
        .values(deleted_at=now)
    )
    res = await session.execute(stmt)
    count = getattr(res, "rowcount", 0)
    return int(count if count is not None else 0)


async def get_recent_merchants(
    session: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 10,
) -> list[RecentMerchantItem]:
    """Returns recently logged unique merchants with their most recent category."""
    # Subquery for most recent occurrence per merchant
    latest_stmt = (
        select(
            Transaction.merchant,
            Transaction.category_id,
            Transaction.subcategory_id,
            Transaction.occurred_at,
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.merchant.is_not(None),
            func.trim(Transaction.merchant) != "",
        )
        .order_by(Transaction.merchant, Transaction.occurred_at.desc())
        .distinct(Transaction.merchant)
    )
    latest_sub = latest_stmt.subquery()

    outer_stmt = (
        select(latest_sub.c.merchant, latest_sub.c.category_id, latest_sub.c.subcategory_id)
        .order_by(latest_sub.c.occurred_at.desc())
        .limit(limit)
    )

    res = await session.execute(outer_stmt)
    return [
        RecentMerchantItem(
            merchant=row[0],
            last_category_id=row[1],
            last_subcategory_id=row[2],
        )
        for row in res.fetchall()
    ]
