import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import PaymentMethod


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None = None
    timezone: str
    currency: str
    week_start: int
    month_start_day: int
    default_payment_method: PaymentMethod
    reminder_enabled: bool
    reminder_time: datetime.time
    theme: str
    created_at: datetime.datetime
    updated_at: datetime.datetime


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str | None = None


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    user: UserRead
    access_token: str
    refresh_token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class UserUpdateRequest(BaseModel):
    name: str | None = None
    timezone: str | None = None
    currency: str | None = None
    week_start: int | None = Field(default=None, ge=1, le=7)
    month_start_day: int | None = Field(default=None, ge=1, le=28)
    default_payment_method: PaymentMethod | None = None
    reminder_enabled: bool | None = None
    reminder_time: datetime.time | None = None
    theme: Literal["system", "light", "dark"] | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class DeleteAccountRequest(BaseModel):
    password: str
