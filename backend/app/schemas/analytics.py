import uuid

from pydantic import BaseModel, ConfigDict


class SummaryPeriodItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    sum_minor: int
    count: int


class MonthBudgetItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    amount_minor: int
    spent_minor: int
    remaining_minor: int
    pct_used: float


class AnalyticsSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    today: SummaryPeriodItem
    week: SummaryPeriodItem
    month: SummaryPeriodItem
    month_budget: MonthBudgetItem | None = None
    avg_daily_minor: int
    projected_month_minor: int


class CategoryAnalyticsChild(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    subcategory_id: uuid.UUID
    name: str
    sum_minor: int
    pct: float


class CategoryAnalyticsItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    category_id: uuid.UUID
    name: str
    icon: str
    color: str
    sum_minor: int
    count: int
    pct: float
    children: list[CategoryAnalyticsChild] = []


class CategoryAnalyticsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    total_minor: int
    items: list[CategoryAnalyticsItem]


class TrendPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    date: str
    sum_minor: int
    count: int


class TrendResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    points: list[TrendPoint]


class PaymentMethodAnalyticsItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    payment_method: str
    sum_minor: int
    count: int
    pct: float


class PaymentMethodAnalyticsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    items: list[PaymentMethodAnalyticsItem]


class TopMerchantItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    merchant: str
    sum_minor: int
    count: int


class TopMerchantsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    items: list[TopMerchantItem]


class CategoryCompareItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    category_id: uuid.UUID
    name: str
    current_minor: int
    previous_minor: int
    delta_minor: int
    delta_pct: float


class CompareResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    current_minor: int
    previous_minor: int
    delta_minor: int
    delta_pct: float
    by_category: list[CategoryCompareItem]


class HeatmapPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    date: str
    sum_minor: int
    count: int
    level: int  # 0 to 4 intensity scale


class HeatmapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    points: list[HeatmapPoint]
