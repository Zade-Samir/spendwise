import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PaymentMethod, RecurFreq, RecurMode
from app.schemas.transaction import TransactionCategoryBrief, TransactionSubcategoryBrief


class RecurringRuleCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    amount_minor: int = Field(gt=0, description="Amount in integer paise (₹1 = 100 paise)")
    category_id: uuid.UUID
    subcategory_id: uuid.UUID | None = None
    merchant: str | None = Field(default=None, max_length=200)
    payment_method: PaymentMethod = PaymentMethod.UPI
    frequency: RecurFreq = RecurFreq.MONTHLY
    interval_count: int = Field(default=1, gt=0)
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    day_of_week: int | None = Field(default=None, ge=1, le=7)
    start_date: datetime.date
    end_date: datetime.date | None = None
    mode: RecurMode = RecurMode.REMIND


class RecurringRuleUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    amount_minor: int | None = Field(default=None, gt=0)
    category_id: uuid.UUID | None = None
    subcategory_id: uuid.UUID | None = None
    merchant: str | None = Field(default=None, max_length=200)
    payment_method: PaymentMethod | None = None
    frequency: RecurFreq | None = None
    interval_count: int | None = Field(default=None, gt=0)
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    day_of_week: int | None = Field(default=None, ge=1, le=7)
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    mode: RecurMode | None = None
    active: bool | None = None


class RecurringRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    amount_minor: int
    category_id: uuid.UUID
    subcategory_id: uuid.UUID | None = None
    category: TransactionCategoryBrief | None = None
    subcategory: TransactionSubcategoryBrief | None = None
    merchant: str | None = None
    payment_method: PaymentMethod
    frequency: RecurFreq
    interval_count: int
    day_of_month: int | None = None
    day_of_week: int | None = None
    start_date: datetime.date
    end_date: datetime.date | None = None
    next_due_date: datetime.date
    mode: RecurMode
    active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


class RecurringConfirmRequest(BaseModel):
    amount_minor: int | None = Field(default=None, gt=0)
    occurred_at: datetime.datetime | None = None
