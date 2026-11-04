import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import BudgetPeriod


class BudgetCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    icon: str
    color: str


class BudgetUpsertRequest(BaseModel):
    category_id: uuid.UUID | None = None
    period: BudgetPeriod = BudgetPeriod.MONTHLY
    amount_minor: int = Field(..., gt=0, description="Budget limit in integer paise")
    alert_threshold_pct: int = Field(
        80, ge=50, le=100, description="Alert threshold percentage between 50 and 100"
    )


class BudgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: BudgetCategoryResponse | None = None
    period: BudgetPeriod
    amount_minor: int
    spent_minor: int
    remaining_minor: int
    pct_used: float
    status: Literal["ok", "warning", "exceeded"]
    alert_threshold_pct: int
    days_left: int
    safe_daily_minor: int
    active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


class BudgetListResponse(BaseModel):
    items: list[BudgetResponse]
    overall: BudgetResponse | None = None
    has_alerts: bool = False
    alert_count: int = 0
