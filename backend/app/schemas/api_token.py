import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field


class ApiTokenCreateRequest(BaseModel):
    name: str = Field(
        ..., min_length=1, max_length=100, description="Friendly device or shortcut label"
    )
    scopes: list[str] = Field(default=["transactions:create"], description="Permission scopes")


class ApiTokenCreatedResponse(BaseModel):
    id: uuid.UUID
    name: str
    token: str = Field(
        ..., description="Plaintext secret token prefixed with 'sw_', displayed only once"
    )
    last4: str
    scopes: list[str]
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class ApiTokenResponse(BaseModel):
    id: uuid.UUID
    name: str
    last4: str
    scopes: list[str]
    last_used_at: datetime.datetime | None
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
