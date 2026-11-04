import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field


class ShortcutTransactionRequest(BaseModel):
    amount: str | int | float = Field(..., description="Amount in Rupees (or paise/string)")
    category: str | None = Field(default=None, description="Category name or ID (fuzzy matched)")
    merchant: str | None = Field(default=None, max_length=150, description="Merchant or payee name")
    payment_method: str = Field(
        default="upi", description="Payment method: upi, card, cash, netbanking, other"
    )
    note: str | None = Field(default=None, max_length=500, description="Optional note or remarks")
    occurred_at: datetime.datetime | None = Field(
        default=None, description="Transaction timestamp in UTC"
    )


class ShortcutTransactionResponse(BaseModel):
    id: uuid.UUID
    amount_minor: int
    merchant: str | None
    category_name: str
    payment_method: str
    note: str | None
    occurred_at: datetime.datetime
    source: str

    model_config = ConfigDict(from_attributes=True)
