import datetime
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.time import (
    get_month_boundaries,
    get_user_timezone,
)
from app.models.budget import Budget
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.insight import InsightItem, InsightListResponse

INSIGHT_CONFIG = {
    "top_category_min_txns": 5,
    "category_delta_min_minor": 50000,  # ₹500
    "category_delta_min_pct": 15.0,
    "avg_daily_min_days": 3,
    "projection_min_days": 7,
    "weekend_spike_ratio": 1.5,
    "weekend_spike_min_txns": 14,
    "small_spends_max_minor": 10000,  # ₹100
    "small_spends_min_pct": 10.0,
    "small_spends_min_count": 15,
    "unlogged_days_window": 7,
    "unlogged_days_min": 2,
    "streak_min_days": 7,
}


def _format_rupees(amount_minor: int) -> str:
    """Formats paise into standard Indian Rupee representation (e.g. ₹6,200)."""
    abs_rupees = abs(amount_minor) // 100
    s = str(abs_rupees)
    if len(s) <= 3:
        formatted = s
    else:
        last3 = s[-3:]
        rest = s[:-3]
        groups: list[str] = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        formatted = ",".join(groups) + "," + last3
    sign = "-" if amount_minor < 0 else ""
    return f"{sign}₹{formatted}"


async def generate_spending_insights(
    db: AsyncSession,
    user: User,
    now: datetime.datetime | None = None,
) -> InsightListResponse:
    """Generates up to 8 deterministic spending insights using the 11-rule statistical engine."""
    now_utc = now or datetime.datetime.now(datetime.UTC)
    tz = get_user_timezone(user.timezone)
    now_tz = now_utc.astimezone(tz)
    period_str = now_tz.strftime("%Y-%m")

    # 1. Month-to-date boundaries
    start_utc, end_utc = get_month_boundaries(now_utc, tz, user.month_start_day)
    local_start = start_utc.astimezone(tz)
    elapsed_days = max((now_tz.date() - local_start.date()).days + 1, 1)

    # 2. Fetch all non-deleted MTD transactions
    mtd_query = (
        select(Transaction)
        .options(selectinload(Transaction.category), selectinload(Transaction.subcategory))
        .where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_at >= start_utc,
            Transaction.occurred_at < now_utc,
        )
        .order_by(Transaction.occurred_at.asc())
    )
    mtd_res = await db.execute(mtd_query)
    mtd_txns = list(mtd_res.scalars().all())

    insights: list[tuple[int, int, InsightItem]] = []  # (severity_rank, magnitude, item)
    # Severity rank: warning = 0, positive = 1, info = 2

    if not mtd_txns:
        return InsightListResponse(items=[])

    total_mtd_minor = sum(t.amount_minor for t in mtd_txns)
    count_mtd = len(mtd_txns)

    # Rule 1: top_category (≥ 5 txns)
    if count_mtd >= INSIGHT_CONFIG["top_category_min_txns"] and total_mtd_minor > 0:
        cat_sums: dict[uuid.UUID, tuple[str, int]] = {}
        for t in mtd_txns:
            if t.category:
                name, current_sum = cat_sums.get(t.category_id, (t.category.name, 0))
                cat_sums[t.category_id] = (name, current_sum + t.amount_minor)

        if cat_sums:
            top_cat_id, (top_name, top_minor) = max(cat_sums.items(), key=lambda x: x[1][1])
            pct = round((top_minor / total_mtd_minor) * 100)
            insights.append(
                (
                    2,
                    top_minor,
                    InsightItem(
                        id="top_category",
                        kind="top_category",
                        severity="info",
                        title="Top Spending Category",
                        body=f"{top_name} is your biggest category this month: {_format_rupees(top_minor)} ({pct}%).",
                        data={
                            "category_id": str(top_cat_id),
                            "amount_minor": top_minor,
                            "pct": pct,
                        },
                        generated_for=period_str,
                    ),
                )
            )

    # Rule 2 & 3: category_increase & category_decrease (vs same elapsed days last month)
    # Boundaries for last month same-elapsed-days
    last_cycle_ref = start_utc - datetime.timedelta(days=1)
    prev_start_utc, _ = get_month_boundaries(last_cycle_ref, tz, user.month_start_day)
    prev_end_utc = prev_start_utc + (now_utc - start_utc)

    prev_query = (
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_at >= prev_start_utc,
            Transaction.occurred_at < prev_end_utc,
        )
    )
    prev_res = await db.execute(prev_query)
    prev_txns = list(prev_res.scalars().all())

    if prev_txns and mtd_txns:
        prev_cat_sums: dict[uuid.UUID, tuple[str, int]] = {}
        for t in prev_txns:
            if t.category:
                p_name, p_sum = prev_cat_sums.get(t.category_id, (t.category.name, 0))
                prev_cat_sums[t.category_id] = (p_name, p_sum + t.amount_minor)

        curr_cat_sums: dict[uuid.UUID, tuple[str, int]] = {}
        for t in mtd_txns:
            if t.category:
                c_name, c_sum = curr_cat_sums.get(t.category_id, (t.category.name, 0))
                curr_cat_sums[t.category_id] = (c_name, c_sum + t.amount_minor)

        # Check for increases
        candidates_up = []
        candidates_down = []
        for cat_id, (name, curr_sum) in curr_cat_sums.items():
            if cat_id in prev_cat_sums:
                _, p_sum = prev_cat_sums[cat_id]
                delta_minor = curr_sum - p_sum
                delta_pct = ((curr_sum - p_sum) / p_sum) * 100 if p_sum > 0 else 0.0
                if (
                    delta_minor >= INSIGHT_CONFIG["category_delta_min_minor"]
                    and delta_pct >= INSIGHT_CONFIG["category_delta_min_pct"]
                ):
                    candidates_up.append((delta_minor, delta_pct, name, cat_id))
                elif (
                    delta_minor <= -INSIGHT_CONFIG["category_delta_min_minor"]
                    and delta_pct <= -INSIGHT_CONFIG["category_delta_min_pct"]
                ):
                    candidates_down.append((delta_minor, delta_pct, name, cat_id))

        if candidates_up:
            best_up = max(candidates_up, key=lambda x: x[0])
            insights.append(
                (
                    0,  # warning
                    best_up[0],
                    InsightItem(
                        id="category_increase",
                        kind="category_increase",
                        severity="warning",
                        title="Category Spending Jump",
                        body=f"Your {best_up[2]} expenses increased by {round(best_up[1])}% ({_format_rupees(best_up[0])}) compared with the same days last month.",
                        data={
                            "category": best_up[2],
                            "delta_minor": best_up[0],
                            "delta_pct": round(best_up[1], 1),
                        },
                        generated_for=period_str,
                    ),
                )
            )
        elif candidates_down:
            best_down = min(candidates_down, key=lambda x: x[0])
            insights.append(
                (
                    1,  # positive
                    abs(best_down[0]),
                    InsightItem(
                        id="category_decrease",
                        kind="category_decrease",
                        severity="positive",
                        title="Spending Cut",
                        body=f"Nice: {best_down[2]} is down {_format_rupees(abs(best_down[0]))} ({round(best_down[1])}%) vs last month.",
                        data={
                            "category": best_down[2],
                            "delta_minor": best_down[0],
                            "delta_pct": round(best_down[1], 1),
                        },
                        generated_for=period_str,
                    ),
                )
            )

    # Rule 4: avg_daily (≥ 3 days elapsed)
    if elapsed_days >= INSIGHT_CONFIG["avg_daily_min_days"]:
        avg_daily_minor = total_mtd_minor // elapsed_days
        insights.append(
            (
                2,
                avg_daily_minor,
                InsightItem(
                    id="avg_daily",
                    kind="avg_daily",
                    severity="info",
                    title="Daily Spending Pace",
                    body=f"Your average daily spending is {_format_rupees(avg_daily_minor)}.",
                    data={"avg_daily_minor": avg_daily_minor, "elapsed_days": elapsed_days},
                    generated_for=period_str,
                ),
            )
        )

    # Rule 5 & 6: projection & budget_warning (query active budgets)
    budget_query = (
        select(Budget)
        .options(selectinload(Budget.category))
        .where(
            Budget.user_id == user.id,
            Budget.active.is_(True),
        )
    )
    b_res = await db.execute(budget_query)
    budgets = list(b_res.scalars().all())

    overall_budget = next((b for b in budgets if b.category_id is None), None)
    if overall_budget and elapsed_days >= INSIGHT_CONFIG["projection_min_days"]:
        local_end = end_utc.astimezone(tz)
        total_cycle_days = max((local_end.date() - local_start.date()).days, 1)
        projected_minor = (total_mtd_minor // elapsed_days) * total_cycle_days
        over_budget_minor = projected_minor - overall_budget.amount_minor

        if over_budget_minor > 0:
            insights.append(
                (
                    0,  # warning
                    over_budget_minor,
                    InsightItem(
                        id="projection",
                        kind="projection",
                        severity="warning",
                        title="Month-End Budget Projection",
                        body=f"At this pace you'll spend ~{_format_rupees(projected_minor)} this month, {_format_rupees(over_budget_minor)} over budget.",
                        data={
                            "projected_minor": projected_minor,
                            "over_budget_minor": over_budget_minor,
                        },
                        generated_for=period_str,
                    ),
                )
            )
        else:
            insights.append(
                (
                    1,  # positive
                    overall_budget.amount_minor - projected_minor,
                    InsightItem(
                        id="projection",
                        kind="projection",
                        severity="positive",
                        title="On Track with Budget",
                        body=f"At this pace you'll spend ~{_format_rupees(projected_minor)} this month, safely within your {_format_rupees(overall_budget.amount_minor)} budget.",
                        data={"projected_minor": projected_minor},
                        generated_for=period_str,
                    ),
                )
            )

    # Rule 6: budget_warning (if any budget warning or exceeded)
    budget_warnings = []
    for b in budgets:
        # Calculate spend for b
        if b.category_id is None:
            b_spent = total_mtd_minor
            cat_name = "Overall"
        else:
            b_spent = sum(
                t.amount_minor
                for t in mtd_txns
                if t.category_id == b.category_id
                or (t.subcategory and t.subcategory.parent_id == b.category_id)
            )
            cat_name = b.category.name if b.category else "Category"

        pct_used = (b_spent / b.amount_minor) * 100 if b.amount_minor > 0 else 0.0
        if b_spent >= b.amount_minor or pct_used >= b.alert_threshold_pct:
            budget_warnings.append((pct_used, cat_name, b_spent, b.amount_minor))

    if budget_warnings:
        highest_warn = max(budget_warnings, key=lambda x: x[0])
        insights.append(
            (
                0,  # warning
                highest_warn[2],
                InsightItem(
                    id="budget_warning",
                    kind="budget_warning",
                    severity="warning",
                    title="Budget Alert",
                    body=f"{highest_warn[1]} is at {round(highest_warn[0])}% of its {_format_rupees(highest_warn[3])} budget.",
                    data={"category": highest_warn[1], "pct_used": round(highest_warn[0], 1)},
                    generated_for=period_str,
                ),
            )
        )

    # Rule 7: weekend_spike (last 4 weeks, ≥ 14 txns)
    four_weeks_ago = now_utc - datetime.timedelta(days=28)
    fw_query = select(Transaction).where(
        Transaction.user_id == user.id,
        Transaction.deleted_at.is_(None),
        Transaction.occurred_at >= four_weeks_ago,
        Transaction.occurred_at < now_utc,
    )
    fw_res = await db.execute(fw_query)
    fw_txns = list(fw_res.scalars().all())

    if len(fw_txns) >= INSIGHT_CONFIG["weekend_spike_min_txns"]:
        weekend_sum = 0
        weekday_sum = 0
        weekend_days = 8  # 4 weekends * 2 days (Sat/Sun)
        weekday_days = 20  # 4 weeks * 5 days

        for t in fw_txns:
            local_dt = t.occurred_at.astimezone(tz)
            if local_dt.weekday() in (5, 6):  # Saturday or Sunday
                weekend_sum += t.amount_minor
            else:
                weekday_sum += t.amount_minor

        avg_weekend = weekend_sum // max(weekend_days, 1)
        avg_weekday = weekday_sum // max(weekday_days, 1)

        if avg_weekday > 0 and (avg_weekend / avg_weekday) >= INSIGHT_CONFIG["weekend_spike_ratio"]:
            ratio = round(avg_weekend / avg_weekday, 1)
            insights.append(
                (
                    2,  # info
                    weekend_sum,
                    InsightItem(
                        id="weekend_spike",
                        kind="weekend_spike",
                        severity="info",
                        title="Weekend Spending Spike",
                        body=f"You spend {ratio}× more per day on weekends.",
                        data={
                            "ratio": ratio,
                            "avg_weekend_minor": avg_weekend,
                            "avg_weekday_minor": avg_weekday,
                        },
                        generated_for=period_str,
                    ),
                )
            )

    # Rule 8: small_spends (< ₹100, ≥ 10% of MTD, ≥ 15 txns)
    small_txns = [t for t in mtd_txns if t.amount_minor < INSIGHT_CONFIG["small_spends_max_minor"]]
    small_count = len(small_txns)
    small_sum = sum(t.amount_minor for t in small_txns)

    if (
        small_count >= INSIGHT_CONFIG["small_spends_min_count"]
        and total_mtd_minor > 0
        and (small_sum / total_mtd_minor) * 100 >= INSIGHT_CONFIG["small_spends_min_pct"]
    ):
        insights.append(
            (
                2,  # info
                small_sum,
                InsightItem(
                    id="small_spends",
                    kind="small_spends",
                    severity="info",
                    title="Small Purchases Add Up",
                    body=f"{small_count} small purchases under ₹100 added up to {_format_rupees(small_sum)}.",
                    data={"count": small_count, "amount_minor": small_sum},
                    generated_for=period_str,
                ),
            )
        )

    # Rule 9: unlogged_days (≥ 2 of the last 7 days have zero transactions)
    # Check each of the last 7 days in user's local tz
    last_7_days_empty = 0
    today_date = now_tz.date()
    logged_dates = {t.occurred_at.astimezone(tz).date() for t in mtd_txns}

    for i in range(1, 8):  # Check past 7 completed or current days
        check_date = today_date - datetime.timedelta(days=i)
        if check_date not in logged_dates:
            last_7_days_empty += 1

    if last_7_days_empty >= INSIGHT_CONFIG["unlogged_days_min"]:
        insights.append(
            (
                2,  # info
                last_7_days_empty,
                InsightItem(
                    id="unlogged_days",
                    kind="unlogged_days",
                    severity="info",
                    title="Unlogged Days",
                    body=f"No expenses logged on {last_7_days_empty} of the last 7 days. Forgot to add any?",
                    data={"unlogged_days": last_7_days_empty},
                    generated_for=period_str,
                ),
            )
        )

    # Rule 10: streak (≥ 7 consecutive days with ≥ 1 transaction ending today or yesterday)
    streak_count = 0
    check_day = today_date
    if check_day not in logged_dates:
        check_day = today_date - datetime.timedelta(days=1)

    while check_day in logged_dates:
        streak_count += 1
        check_day -= datetime.timedelta(days=1)

    if streak_count >= INSIGHT_CONFIG["streak_min_days"]:
        insights.append(
            (
                1,  # positive
                streak_count,
                InsightItem(
                    id="streak",
                    kind="streak",
                    severity="positive",
                    title="Logging Streak",
                    body=f"{streak_count}-day logging streak! 🔥",
                    data={"streak_days": streak_count},
                    generated_for=period_str,
                ),
            )
        )

    # Rule 11: largest_expense (Always when ≥ 1 txn in month)
    if mtd_txns:
        largest_t = max(mtd_txns, key=lambda t: t.amount_minor)
        place = largest_t.merchant or (
            largest_t.category.name if largest_t.category else "an expense"
        )
        insights.append(
            (
                2,  # info
                largest_t.amount_minor,
                InsightItem(
                    id="largest_expense",
                    kind="largest_expense",
                    severity="info",
                    title="Largest Expense",
                    body=f"Your largest expense this month: {_format_rupees(largest_t.amount_minor)} at {place}.",
                    data={"amount_minor": largest_t.amount_minor, "merchant": largest_t.merchant},
                    generated_for=period_str,
                ),
            )
        )

    # Sort insights by severity_rank (warning: 0 < positive: 1 < info: 2), then magnitude desc
    insights.sort(key=lambda x: (x[0], -x[1]))

    # Deduplicate by kind (keep highest magnitude per rule)
    seen_kinds: set[str] = set()
    deduped_items: list[InsightItem] = []
    for _, _, item in insights:
        if item.kind not in seen_kinds:
            seen_kinds.add(item.kind)
            deduped_items.append(item)
        if len(deduped_items) >= 8:
            break

    return InsightListResponse(items=deduped_items)
