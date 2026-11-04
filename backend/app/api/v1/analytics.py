import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsSummaryResponse,
    CategoryAnalyticsResponse,
    CompareResponse,
    HeatmapResponse,
    PaymentMethodAnalyticsResponse,
    TopMerchantsResponse,
    TrendResponse,
)
from app.services.analytics import (
    get_analytics_by_category,
    get_analytics_by_payment_method,
    get_analytics_compare,
    get_analytics_heatmap,
    get_analytics_summary,
    get_analytics_trend,
    get_top_merchants,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def read_analytics_summary(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> AnalyticsSummaryResponse:
    """Returns executive spending metrics for today, this week, and the active monthly salary cycle."""
    return await get_analytics_summary(session, current_user)


@router.get("/by-category", response_model=CategoryAnalyticsResponse)
async def read_analytics_by_category(
    period: str = Query("month", description="Period preset: week, month, last_month"),
    from_date: datetime.date | None = Query(
        None, alias="from", description="Custom start date (inclusive)"
    ),
    to_date: datetime.date | None = Query(
        None, alias="to", description="Custom end date (inclusive)"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CategoryAnalyticsResponse:
    """Returns category and subcategory spending distribution within the specified interval."""
    return await get_analytics_by_category(session, current_user, from_date, to_date, period)


@router.get("/trend", response_model=TrendResponse)
async def read_analytics_trend(
    period: str = Query("month", description="Period preset: week, month, last_month"),
    from_date: datetime.date | None = Query(
        None, alias="from", description="Custom start date (inclusive)"
    ),
    to_date: datetime.date | None = Query(
        None, alias="to", description="Custom end date (inclusive)"
    ),
    granularity: str = Query("day", description="Temporal granularity: day"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TrendResponse:
    """Returns day-by-day spending trend, strictly zero-filling missing dates."""
    return await get_analytics_trend(session, current_user, from_date, to_date, period)


@router.get("/by-payment-method", response_model=PaymentMethodAnalyticsResponse)
async def read_analytics_by_payment_method(
    period: str = Query("month", description="Period preset: week, month, last_month"),
    from_date: datetime.date | None = Query(
        None, alias="from", description="Custom start date (inclusive)"
    ),
    to_date: datetime.date | None = Query(
        None, alias="to", description="Custom end date (inclusive)"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PaymentMethodAnalyticsResponse:
    """Returns spending breakdown across payment methods (UPI, Cash, Card, Bank)."""
    return await get_analytics_by_payment_method(session, current_user, from_date, to_date, period)


@router.get("/top-merchants", response_model=TopMerchantsResponse)
async def read_top_merchants(
    limit: int = Query(5, ge=1, le=50, description="Max number of merchants to return"),
    period: str = Query("month", description="Period preset: week, month, last_month"),
    from_date: datetime.date | None = Query(
        None, alias="from", description="Custom start date (inclusive)"
    ),
    to_date: datetime.date | None = Query(
        None, alias="to", description="Custom end date (inclusive)"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TopMerchantsResponse:
    """Returns top payees/merchants by total spend in interval."""
    return await get_top_merchants(session, current_user, from_date, to_date, period, limit)


@router.get("/compare", response_model=CompareResponse)
async def read_analytics_compare(
    period: str = Query("month", description="Comparison period preset (e.g. month)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> CompareResponse:
    """Performs fair same-elapsed-days period comparison (Month-to-date vs Previous Month same days)."""
    return await get_analytics_compare(session, current_user, period)


@router.get("/heatmap", response_model=HeatmapResponse)
async def read_analytics_heatmap(
    period: str = Query("month", description="Period preset: week, month, last_month"),
    from_date: datetime.date | None = Query(
        None, alias="from", description="Custom start date (inclusive)"
    ),
    to_date: datetime.date | None = Query(
        None, alias="to", description="Custom end date (inclusive)"
    ),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> HeatmapResponse:
    """Returns zero-filled daily expenditure points with 0–4 intensity levels for calendar heatmap rendering."""
    return await get_analytics_heatmap(session, current_user, from_date, to_date, period)
