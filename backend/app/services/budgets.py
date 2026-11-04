import datetime
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.time import get_month_boundaries, get_user_timezone, get_week_boundaries
from app.models.budget import Budget
from app.models.category import Category
from app.models.enums import BudgetPeriod
from app.models.transaction import Transaction
from app.models.user import NotificationLog, User
from app.schemas.budget import (
    BudgetCategoryResponse,
    BudgetListResponse,
    BudgetResponse,
    BudgetUpsertRequest,
)


def _get_budget_period_boundaries(
    user: User, period: BudgetPeriod, now: datetime.datetime | None = None
) -> tuple[datetime.datetime, datetime.datetime]:
    tz = get_user_timezone(user.timezone)
    now_utc = now or datetime.datetime.now(datetime.UTC)
    if period == BudgetPeriod.WEEKLY:
        return get_week_boundaries(now_utc, tz, user.week_start)
    # Default is MONTHLY
    return get_month_boundaries(now_utc, tz, user.month_start_day)


async def _calc_budget_spending(
    db: AsyncSession,
    user: User,
    category_id: uuid.UUID | None,
    start_utc: datetime.datetime,
    end_utc: datetime.datetime,
) -> int:
    """Calculates total non-deleted transaction expenditure in half-open interval."""
    if category_id is None:
        query = select(func.coalesce(func.sum(Transaction.amount_minor), 0)).where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_at >= start_utc,
            Transaction.occurred_at < end_utc,
        )
        result = await db.execute(query)
        spent: int = result.scalar() or 0
        return spent

    # Find category and its children
    sub_query = select(Category.id).where(
        Category.parent_id == category_id,
        (Category.user_id.is_(None)) | (Category.user_id == user.id),
    )
    sub_res = await db.execute(sub_query)
    child_ids = [row[0] for row in sub_res.all()]

    cat_filter = Transaction.category_id == category_id
    if child_ids:
        cat_filter = cat_filter | (Transaction.subcategory_id.in_(child_ids))

    query = select(func.coalesce(func.sum(Transaction.amount_minor), 0)).where(
        Transaction.user_id == user.id,
        Transaction.deleted_at.is_(None),
        Transaction.occurred_at >= start_utc,
        Transaction.occurred_at < end_utc,
        cat_filter,
    )
    result = await db.execute(query)
    spent = result.scalar() or 0
    return spent


async def _build_budget_response(
    db: AsyncSession,
    user: User,
    budget: Budget,
    now: datetime.datetime | None = None,
) -> BudgetResponse:
    now_utc = now or datetime.datetime.now(datetime.UTC)
    tz = get_user_timezone(user.timezone)
    start_utc, end_utc = _get_budget_period_boundaries(user, budget.period, now_utc)

    spent_minor = await _calc_budget_spending(db, user, budget.category_id, start_utc, end_utc)
    remaining_minor = max(budget.amount_minor - spent_minor, 0)
    pct_used = (
        round((spent_minor / budget.amount_minor) * 100, 1) if budget.amount_minor > 0 else 0.0
    )

    if spent_minor >= budget.amount_minor:
        b_status: str = "exceeded"
    elif pct_used >= budget.alert_threshold_pct:
        b_status = "warning"
    else:
        b_status = "ok"

    local_now = now_utc.astimezone(tz)
    local_end = end_utc.astimezone(tz)
    # Remaining days in active cycle inclusive of today
    days_left = max((local_end.date() - local_now.date()).days, 1)
    safe_daily_minor = max(remaining_minor, 0) // days_left

    category_resp: BudgetCategoryResponse | None = None
    if budget.category:
        category_resp = BudgetCategoryResponse(
            id=budget.category.id,
            name=budget.category.name,
            icon=budget.category.icon,
            color=budget.category.color,
        )

    return BudgetResponse(
        id=budget.id,
        category=category_resp,
        period=budget.period,
        amount_minor=budget.amount_minor,
        spent_minor=spent_minor,
        remaining_minor=remaining_minor,
        pct_used=pct_used,
        status=b_status,  # type: ignore[arg-type]
        alert_threshold_pct=budget.alert_threshold_pct,
        days_left=days_left,
        safe_daily_minor=safe_daily_minor,
        active=budget.active,
        created_at=budget.created_at,
        updated_at=budget.updated_at,
    )


async def upsert_budget(
    db: AsyncSession,
    user: User,
    payload: BudgetUpsertRequest,
) -> BudgetResponse:
    """Creates or updates an overall or category budget for the authenticated user."""
    # Validate category if provided
    category: Category | None = None
    if payload.category_id is not None:
        cat_query = select(Category).where(
            Category.id == payload.category_id,
            (Category.user_id.is_(None)) | (Category.user_id == user.id),
        )
        cat_res = await db.execute(cat_query)
        category = cat_res.scalar_one_or_none()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found",
            )

    # Check for existing budget (active or inactive)
    existing_query = (
        select(Budget)
        .options(selectinload(Budget.category))
        .where(
            Budget.user_id == user.id,
            Budget.period == payload.period,
            Budget.category_id == payload.category_id
            if payload.category_id is not None
            else Budget.category_id.is_(None),
        )
    )
    existing_res = await db.execute(existing_query)
    budget = existing_res.scalar_one_or_none()

    if budget:
        budget.amount_minor = payload.amount_minor
        budget.alert_threshold_pct = payload.alert_threshold_pct
        budget.active = True
        budget.updated_at = datetime.datetime.now(datetime.UTC)
    else:
        budget = Budget(
            user_id=user.id,
            category_id=payload.category_id,
            period=payload.period,
            amount_minor=payload.amount_minor,
            alert_threshold_pct=payload.alert_threshold_pct,
            active=True,
        )
        db.add(budget)

    await db.flush()
    if category and not budget.category:
        budget.category = category

    await db.commit()
    await db.refresh(budget)

    return await _build_budget_response(db, user, budget)


async def get_budgets_with_status(
    db: AsyncSession,
    user: User,
) -> BudgetListResponse:
    """Returns all active budgets with live spending, remaining balances, and status."""
    query = (
        select(Budget)
        .options(selectinload(Budget.category))
        .where(
            Budget.user_id == user.id,
            Budget.active.is_(True),
        )
        .order_by(Budget.created_at.asc())
    )
    res = await db.execute(query)
    budgets = list(res.scalars().all())

    items: list[BudgetResponse] = []
    overall: BudgetResponse | None = None
    alert_count = 0

    for b in budgets:
        resp = await _build_budget_response(db, user, b)
        if resp.status in ("warning", "exceeded"):
            alert_count += 1
        if b.category_id is None:
            overall = resp
        else:
            items.append(resp)

    # Sort category budgets by pct_used descending so highest utilized appear first
    items.sort(key=lambda x: x.pct_used, reverse=True)

    return BudgetListResponse(
        items=items,
        overall=overall,
        has_alerts=alert_count > 0,
        alert_count=alert_count,
    )


async def delete_budget(
    db: AsyncSession,
    user: User,
    budget_id: uuid.UUID,
) -> None:
    """Deletes an active budget for the authenticated user."""
    query = select(Budget).where(
        Budget.id == budget_id,
        Budget.user_id == user.id,
    )
    res = await db.execute(query)
    budget = res.scalar_one_or_none()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found",
        )

    await db.delete(budget)
    await db.commit()


async def check_budget_alerts(
    db: AsyncSession,
    user: User,
) -> list[NotificationLog]:
    """Evaluates active budgets against alert thresholds and logs deduplicated alerts."""
    query = (
        select(Budget)
        .options(selectinload(Budget.category))
        .where(
            Budget.user_id == user.id,
            Budget.active.is_(True),
        )
    )
    res = await db.execute(query)
    budgets = list(res.scalars().all())

    now_utc = datetime.datetime.now(datetime.UTC)
    new_alerts: list[NotificationLog] = []

    for b in budgets:
        start_utc, end_utc = _get_budget_period_boundaries(user, b.period, now_utc)
        spent_minor = await _calc_budget_spending(db, user, b.category_id, start_utc, end_utc)
        pct_used = (spent_minor / b.amount_minor) * 100 if b.amount_minor > 0 else 0.0

        level: str | None = None
        if spent_minor >= b.amount_minor:
            level = "exceeded"
        elif pct_used >= b.alert_threshold_pct:
            level = "warning"

        if not level:
            continue

        dedupe_key = f"{b.id}:{start_utc.date().isoformat()}:{level}"
        existing_log_query = select(NotificationLog).where(
            NotificationLog.user_id == user.id,
            NotificationLog.kind == "budget_alert",
            NotificationLog.dedupe_key == dedupe_key,
        )
        existing_res = await db.execute(existing_log_query)
        if existing_res.scalar_one_or_none() is None:
            log_entry = NotificationLog(
                user_id=user.id,
                kind="budget_alert",
                dedupe_key=dedupe_key,
            )
            db.add(log_entry)
            new_alerts.append(log_entry)

    if new_alerts:
        await db.commit()

    return new_alerts
