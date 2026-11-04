import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PaymentMethod, TxnSource


class TransactionCategoryBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    icon: str
    color: str


class TransactionSubcategoryBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amount_minor: int
    category: TransactionCategoryBrief
    subcategory: TransactionSubcategoryBrief | None = None
    merchant: str | None = None
    description: str | None = None
    notes: str | None = None
    payment_method: PaymentMethod
    occurred_at: datetime.datetime
    source: TxnSource
    client_id: uuid.UUID | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TransactionCreateRequest(BaseModel):
    amount_minor: int = Field(..., gt=0, le=1_000_000_000)
    category_id: uuid.UUID
    subcategory_id: uuid.UUID | None = None
    merchant: str | None = None
    description: str | None = None
    notes: str | None = None
    payment_method: PaymentMethod = PaymentMethod.UPI
    occurred_at: datetime.datetime | None = None
    client_id: uuid.UUID | None = None
    source: TxnSource = TxnSource.MANUAL


class TransactionUpdateRequest(BaseModel):
    amount_minor: int | None = Field(default=None, gt=0, le=1_000_000_000)
    category_id: uuid.UUID | None = None
    subcategory_id: uuid.UUID | None = None
    merchant: str | None = None
    description: str | None = None
    notes: str | None = None
    payment_method: PaymentMethod | None = None
    occurred_at: datetime.datetime | None = None


class TransactionTotals(BaseModel):
    count: int
    sum_minor: int


class TransactionListResponse(BaseModel):
    items: list[TransactionRead]
    next_cursor: str | None = None
    totals: TransactionTotals


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID] = Field(..., min_length=1, max_length=200)


class BulkDeleteResponse(BaseModel):
    deleted: int


class RecentMerchantItem(BaseModel):
    merchant: str
    last_category_id: uuid.UUID
    last_subcategory_id: uuid.UUID | None = None
