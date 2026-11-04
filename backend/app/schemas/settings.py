import datetime

from pydantic import BaseModel, Field


class UserSettingsResponse(BaseModel):
    name: str | None = None
    email: str
    timezone: str
    currency: str
    month_start_day: int
    reminder_enabled: bool
    reminder_time: str
    theme: str
    has_push_subscription: bool


class UserSettingsUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None, max_length=50)
    month_start_day: int | None = Field(default=None, ge=1, le=28)
    reminder_enabled: bool | None = None
    reminder_time: datetime.time | str | None = None
    theme: str | None = Field(default=None, pattern="^(system|light|dark)$")
