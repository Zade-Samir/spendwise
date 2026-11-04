import datetime
import uuid
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import (
    get_day_boundaries,
    get_month_boundaries,
    get_user_timezone,
    get_week_boundaries,
)
from app.models.budget import Budget
from app.models.category import Category
from app.models.enums import BudgetPeriod
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    CategoryAnalyticsChild,
    CategoryAnalyticsItem,
    CategoryAnalyticsResponse,
    CategoryCompareItem,
    CompareResponse,
    HeatmapPoint,
    HeatmapResponse,
    MonthBudgetItem,
    PaymentMethodAnalyticsItem,
    PaymentMethodAnalyticsResponse,
    SummaryPeriodItem,
    TopMerchantItem,
    TopMerchantsResponse,
    TrendPoint,
    TrendResponse,
)


async def get_analytics_summary(
    session: AsyncSession,
    user: User,
) -> AnalyticsSummaryResponse:
    """Computes executive spending metrics for today, this week, and the active monthly salary cycle."""
    tz = get_user_timezone(user.timezone)
    now_utc = datetime.datetime.now(datetime.UTC)
    now_local = now_utc.astimezone(tz)

    today_start, today_end = get_day_boundaries(now_local, tz)
    week_start, week_end = get_week_boundaries(now_local, tz, week_start=user.week_start)
    month_start, month_end = get_month_boundaries(
        now_local, tz, month_start_day=user.month_start_day
    )

    # Aggregation helper
    async def get_period_stats(
        start_utc: datetime.datetime, end_utc: datetime.datetime
    ) -> tuple[int, int]:
        stmt = select(
            func.coalesce(func.sum(Transaction.amount_minor), 0),
            func.count(Transaction.id),
        ).where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_at >= start_utc,
            Transaction.occurred_at < end_utc,
        )
        res = await session.execute(stmt)
        row = res.one()
        return int(row[0]), int(row[1])

    today_sum, today_count = await get_period_stats(today_start, today_end)
    week_sum, week_count = await get_period_stats(week_start, week_end)
    month_sum, month_count = await get_period_stats(month_start, month_end)

    # Monthly overall budget if set
    budget_stmt = (
        select(Budget)
        .where(
            Budget.user_id == user.id,
            Budget.category_id.is_(None),
            Budget.period == BudgetPeriod.MONTHLY,
            Budget.active.is_(True),
        )
        .limit(1)
    )
    budget_res = await session.execute(budget_stmt)
    active_budget = budget_res.scalar_one_or_none()

    month_budget: MonthBudgetItem | None = None
    if active_budget:
        amt = active_budget.amount_minor
        spent = month_sum
        remaining = max(amt - spent, 0)
        pct = round((spent / amt) * 100, 1) if amt > 0 else 0.0
        month_budget = MonthBudgetItem(
            amount_minor=amt,
            spent_minor=spent,
            remaining_minor=remaining,
            pct_used=pct,
        )

    # Average daily spend and projected month spend
    # Days elapsed including today
    days_elapsed = max(int((now_utc - month_start).days) + 1, 1)
    total_days_in_cycle = max(int((month_end - month_start).days), 1)

    avg_daily_minor = int(month_sum // days_elapsed)
    projected_month_minor = int(avg_daily_minor * total_days_in_cycle)

    return AnalyticsSummaryResponse(
        today=SummaryPeriodItem(sum_minor=today_sum, count=today_count),
        week=SummaryPeriodItem(sum_minor=week_sum, count=week_count),
        month=SummaryPeriodItem(sum_minor=month_sum, count=month_count),
        month_budget=month_budget,
        avg_daily_minor=avg_daily_minor,
        projected_month_minor=projected_month_minor,
    )


def resolve_date_range(
    user: User,
    from_date: datetime.date | None = None,
    to_date: datetime.date | None = None,
    period: str = "month",
) -> tuple[datetime.datetime, datetime.datetime, ZoneInfo]:
    """Resolves half-open UTC bounds [start_utc, end_utc) for user analytical queries."""
    tz = get_user_timezone(user.timezone)
    now_local = datetime.datetime.now(datetime.UTC).astimezone(tz)

    if from_date and to_date:
        start_local = datetime.datetime(
            from_date.year, from_date.month, from_date.day, 0, 0, 0, tzinfo=tz
        )
        end_local = datetime.datetime(
            to_date.year, to_date.month, to_date.day, 0, 0, 0, tzinfo=tz
        ) + datetime.timedelta(days=1)
        return start_local.astimezone(datetime.UTC), end_local.astimezone(datetime.UTC), tz

    if period == "week":
        start_utc, end_utc = get_week_boundaries(now_local, tz, week_start=user.week_start)
    elif period == "last_month":
        # Anchored to previous month salary cycle
        curr_m_start, _ = get_month_boundaries(now_local, tz, month_start_day=user.month_start_day)
        prev_local = (curr_m_start - datetime.timedelta(days=1)).astimezone(tz)
        start_utc, end_utc = get_month_boundaries(
            prev_local, tz, month_start_day=user.month_start_day
        )
    else:  # default "month"
        start_utc, end_utc = get_month_boundaries(
            now_local, tz, month_start_day=user.month_start_day
        )

    return start_utc, end_utc, tz


async def get_analytics_by_category(
    session: AsyncSession,
    user: User,
    from_date: datetime.date | None = None,
    to_date: datetime.date | None = None,
    period: str = "month",
) -> CategoryAnalyticsResponse:
    """Calculates category and subcategory spending distribution within the specified interval."""
    start_utc, end_utc, _ = resolve_date_range(user, from_date, to_date, period)

    # 1. Query parent categories with aggregated sum and count
    stmt = (
        select(
            Category.id,
            Category.name,
            Category.icon,
            Category.color,
            func.coalesce(func.sum(Transaction.amount_minor), 0).label("cat_sum"),
            func.count(Transaction.id).label("cat_count"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_at >= start_utc,
            Transaction.occurred_at < end_utc,
        )
        .group_by(Category.id, Category.name, Category.icon, Category.color)
        .order_by(func.sum(Transaction.amount_minor).desc())
    )
    res = await session.execute(stmt)
    parent_rows = res.all()

    total_minor = sum(int(row.cat_sum) for row in parent_rows)

    # 2. Query subcategory breakdowns within this interval
    sub_stmt = (
        select(
            Transaction.category_id,
            Transaction.subcategory_id,
            Category.name,
            func.coalesce(func.sum(Transaction.amount_minor), 0).label("sub_sum"),
        )
        .join(Category, Category.id == Transaction.subcategory_id)
        .where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.subcategory_id.isnot(None),
            Transaction.occurred_at >= start_utc,
            Transaction.occurred_at < end_utc,
        )
        .group_by(Transaction.category_id, Transaction.subcategory_id, Category.name)
        .order_by(func.sum(Transaction.amount_minor).desc())
    )
    sub_res = await session.execute(sub_stmt)
    sub_rows = sub_res.all()

    sub_map: dict[uuid.UUID, list[CategoryAnalyticsChild]] = {}
    for sub in sub_rows:
        cat_id = sub.category_id
        sub_minor = int(sub.sub_sum)
        # Parent total for percentage of parent
        parent_tot = next((int(p.cat_sum) for p in parent_rows if p.id == cat_id), 0)
        sub_pct = round((sub_minor / parent_tot) * 100, 1) if parent_tot > 0 else 0.0
        child = CategoryAnalyticsChild(
            subcategory_id=sub.subcategory_id,
            name=sub.name,
            sum_minor=sub_minor,
            pct=sub_pct,
        )
        sub_map.setdefault(cat_id, []).append(child)

    items: list[CategoryAnalyticsItem] = []
    for row in parent_rows:
        cat_sum = int(row.cat_sum)
        pct = round((cat_sum / total_minor) * 100, 1) if total_minor > 0 else 0.0
        items.append(
            CategoryAnalyticsItem(
                category_id=row.id,
                name=row.name,
                icon=row.icon,
                color=row.color,
                sum_minor=cat_sum,
                count=int(row.cat_count),
                pct=pct,
                children=sub_map.get(row.id, []),
            )
        )

    return CategoryAnalyticsResponse(total_minor=total_minor, items=items)


async def get_analytics_trend(
    session: AsyncSession,
    user: User,
    from_date: datetime.date | None = None,
    to_date: datetime.date | None = None,
    period: str = "month",
) -> TrendResponse:
    """Returns chronological day-by-day spending trend, strictly zero-filling missing dates."""
    start_utc, end_utc, tz = resolve_date_range(user, from_date, to_date, period)

    # Local date string grouping in PostgreSQL
    date_expr = func.date(func.timezone(user.timezone, Transaction.occurred_at))
    stmt = (
        select(
            date_expr.label("txn_date"),
            func.coalesce(func.sum(Transaction.amount_minor), 0).label("day_sum"),
            func.count(Transaction.id).label("day_count"),
        )
        .where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_at >= start_utc,
            Transaction.occurred_at < end_utc,
        )
        .group_by(date_expr)
        .order_by(date_expr.asc())
    )
    res = await session.execute(stmt)
    rows = res.all()

    # Map existing data points by date string
    data_map: dict[str, tuple[int, int]] = {
        str(row.txn_date): (int(row.day_sum), int(row.day_count)) for row in rows
    }

    # Zero-fill every single calendar day from start_date to end_date - 1 day
    start_local = start_utc.astimezone(tz).date()
    end_local = (end_utc.astimezone(tz) - datetime.timedelta(seconds=1)).date()

    points: list[TrendPoint] = []
    curr = start_local
    while curr <= end_local:
        date_str = curr.isoformat()
        if date_str in data_map:
            s, c = data_map[date_str]
            points.append(TrendPoint(date=date_str, sum_minor=s, count=c))
        else:
            points.append(TrendPoint(date=date_str, sum_minor=0, count=0))
        curr += datetime.timedelta(days=1)

    return TrendResponse(points=points)


async def get_analytics_by_payment_method(
    session: AsyncSession,
    user: User,
    from_date: datetime.date | None = None,
    to_date: datetime.date | None = None,
    period: str = "month",
) -> PaymentMethodAnalyticsResponse:
    """Calculates spending breakdown across payment methods (UPI, Cash, Card, Bank)."""
    start_utc, end_utc, _ = resolve_date_range(user, from_date, to_date, period)

    stmt = (
        select(
            Transaction.payment_method,
            func.coalesce(func.sum(Transaction.amount_minor), 0).label("pm_sum"),
            func.count(Transaction.id).label("pm_count"),
        )
        .where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_at >= start_utc,
            Transaction.occurred_at < end_utc,
        )
        .group_by(Transaction.payment_method)
        .order_by(func.sum(Transaction.amount_minor).desc())
    )
    res = await session.execute(stmt)
    rows = res.all()

    total_minor = sum(int(row.pm_sum) for row in rows)
    items: list[PaymentMethodAnalyticsItem] = []
    for row in rows:
        pm_sum = int(row.pm_sum)
        pct = round((pm_sum / total_minor) * 100, 1) if total_minor > 0 else 0.0
        pm_val = (
            row.payment_method.value
            if hasattr(row.payment_method, "value")
            else str(row.payment_method)
        )
        items.append(
            PaymentMethodAnalyticsItem(
                payment_method=pm_val,
                sum_minor=pm_sum,
                count=int(row.pm_count),
                pct=pct,
            )
        )

    return PaymentMethodAnalyticsResponse(items=items)


async def get_top_merchants(
    session: AsyncSession,
    user: User,
    from_date: datetime.date | None = None,
    to_date: datetime.date | None = None,
    period: str = "month",
    limit: int = 5,
) -> TopMerchantsResponse:
    """Returns top payees/merchants by total spend in interval."""
    start_utc, end_utc, _ = resolve_date_range(user, from_date, to_date, period)

    stmt = (
        select(
            Transaction.merchant,
            func.coalesce(func.sum(Transaction.amount_minor), 0).label("m_sum"),
            func.count(Transaction.id).label("m_count"),
        )
        .where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.merchant.isnot(None),
            Transaction.merchant != "",
            Transaction.occurred_at >= start_utc,
            Transaction.occurred_at < end_utc,
        )
        .group_by(Transaction.merchant)
        .order_by(func.sum(Transaction.amount_minor).desc())
        .limit(limit)
    )
    res = await session.execute(stmt)
    rows = res.all()

    items = [
        TopMerchantItem(
            merchant=str(row.merchant), sum_minor=int(row.m_sum), count=int(row.m_count)
        )
        for row in rows
    ]
    return TopMerchantsResponse(items=items)


async def get_analytics_compare(
    session: AsyncSession,
    user: User,
    period: str = "month",
) -> CompareResponse:
    """Performs fair same-elapsed-days period comparison (e.g. Month-to-date vs Previous Month same days)."""
    tz = get_user_timezone(user.timezone)
    now_utc = datetime.datetime.now(datetime.UTC)
    now_local = now_utc.astimezone(tz)

    curr_start_utc, curr_end_utc = get_month_boundaries(
        now_local, tz, month_start_day=user.month_start_day
    )
    # Elapsed duration in seconds from start of current month cycle
    elapsed_seconds = max((now_utc - curr_start_utc).total_seconds(), 0)

    # Previous month cycle boundaries
    prev_local_point = (curr_start_utc - datetime.timedelta(days=1)).astimezone(tz)
    prev_start_utc, prev_end_utc = get_month_boundaries(
        prev_local_point, tz, month_start_day=user.month_start_day
    )

    # Cutoff in previous month matches elapsed duration, capped at prev_end_utc
    prev_cutoff_utc = min(
        prev_start_utc + datetime.timedelta(seconds=elapsed_seconds), prev_end_utc
    )

    # Query current spend
    curr_stmt = select(
        func.coalesce(func.sum(Transaction.amount_minor), 0),
    ).where(
        Transaction.user_id == user.id,
        Transaction.deleted_at.is_(None),
        Transaction.occurred_at >= curr_start_utc,
        Transaction.occurred_at < now_utc,
    )
    curr_res = await session.execute(curr_stmt)
    curr_total = int(curr_res.scalar_one())

    # Query previous spend up to same elapsed time
    prev_stmt = select(
        func.coalesce(func.sum(Transaction.amount_minor), 0),
    ).where(
        Transaction.user_id == user.id,
        Transaction.deleted_at.is_(None),
        Transaction.occurred_at >= prev_start_utc,
        Transaction.occurred_at < prev_cutoff_utc,
    )
    prev_res = await session.execute(prev_stmt)
    prev_total = int(prev_res.scalar_one())

    delta_minor = curr_total - prev_total
    delta_pct = round(((curr_total - prev_total) / prev_total) * 100, 1) if prev_total > 0 else 0.0

    # Category comparisons
    curr_cat_stmt = (
        select(
            Category.id,
            Category.name,
            func.coalesce(func.sum(Transaction.amount_minor), 0).label("sum_minor"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_at >= curr_start_utc,
            Transaction.occurred_at < now_utc,
        )
        .group_by(Category.id, Category.name)
    )
    curr_cat_res = await session.execute(curr_cat_stmt)
    curr_cat_map = {row.id: (row.name, int(row.sum_minor)) for row in curr_cat_res.all()}

    prev_cat_stmt = (
        select(
            Category.id,
            Category.name,
            func.coalesce(func.sum(Transaction.amount_minor), 0).label("sum_minor"),
        )
        .join(Transaction, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_at >= prev_start_utc,
            Transaction.occurred_at < prev_cutoff_utc,
        )
        .group_by(Category.id, Category.name)
    )
    prev_cat_res = await session.execute(prev_cat_stmt)
    prev_cat_map = {row.id: (row.name, int(row.sum_minor)) for row in prev_cat_res.all()}

    all_cat_ids = set(curr_cat_map.keys()) | set(prev_cat_map.keys())
    cat_items: list[CategoryCompareItem] = []
    for cid in all_cat_ids:
        name = curr_cat_map.get(cid, ("", 0))[0] or prev_cat_map.get(cid, ("", 0))[0]
        c_minor = curr_cat_map.get(cid, ("", 0))[1]
        p_minor = prev_cat_map.get(cid, ("", 0))[1]
        c_delta = c_minor - p_minor
        c_pct = round((c_delta / p_minor) * 100, 1) if p_minor > 0 else 0.0
        cat_items.append(
            CategoryCompareItem(
                category_id=cid,
                name=name,
                current_minor=c_minor,
                previous_minor=p_minor,
                delta_minor=c_delta,
                delta_pct=c_pct,
            )
        )

    cat_items.sort(key=lambda x: abs(x.delta_minor), reverse=True)

    return CompareResponse(
        current_minor=curr_total,
        previous_minor=prev_total,
        delta_minor=delta_minor,
        delta_pct=delta_pct,
        by_category=cat_items,
    )


async def get_analytics_heatmap(
    session: AsyncSession,
    user: User,
    from_date: datetime.date | None = None,
    to_date: datetime.date | None = None,
    period: str = "month",
) -> HeatmapResponse:
    """Returns zero-filled daily expenditure points with 0–4 intensity levels for calendar heatmap rendering."""
    trend = await get_analytics_trend(session, user, from_date, to_date, period)
    max_spend = max((p.sum_minor for p in trend.points), default=0)

    points: list[HeatmapPoint] = []
    for p in trend.points:
        if p.sum_minor == 0 or max_spend == 0:
            level = 0
        else:
            ratio = p.sum_minor / max_spend
            if ratio <= 0.25:
                level = 1
            elif ratio <= 0.50:
                level = 2
            elif ratio <= 0.75:
                level = 3
            else:
                level = 4
        points.append(HeatmapPoint(date=p.date, sum_minor=p.sum_minor, count=p.count, level=level))

    return HeatmapResponse(points=points)
