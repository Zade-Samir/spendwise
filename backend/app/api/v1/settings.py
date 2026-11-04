import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import ValidationError
from app.models.user import PushSubscription, User
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdateRequest

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=UserSettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """Returns the authenticated user's profile and notification settings."""
    sub_count_stmt = select(func.count(PushSubscription.id)).where(
        PushSubscription.user_id == current_user.id
    )
    sub_count = (await session.execute(sub_count_stmt)).scalar_one() or 0

    reminder_time_str = current_user.reminder_time.strftime("%H:%M")

    return UserSettingsResponse(
        name=current_user.name,
        email=current_user.email,
        timezone=current_user.timezone,
        currency=current_user.currency,
        month_start_day=current_user.month_start_day,
        reminder_enabled=current_user.reminder_enabled,
        reminder_time=reminder_time_str,
        theme=current_user.theme,
        has_push_subscription=sub_count > 0,
    )


@router.patch("", response_model=UserSettingsResponse)
async def update_settings(
    payload: UserSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> UserSettingsResponse:
    """Updates user notification preferences, timezone, or display theme."""
    if payload.name is not None:
        current_user.name = payload.name.strip()

    if payload.timezone is not None:
        current_user.timezone = payload.timezone.strip()

    if payload.month_start_day is not None:
        current_user.month_start_day = payload.month_start_day

    if payload.reminder_enabled is not None:
        current_user.reminder_enabled = payload.reminder_enabled

    if payload.reminder_time is not None:
        if isinstance(payload.reminder_time, str):
            try:
                parts = payload.reminder_time.split(":")
                current_user.reminder_time = datetime.time(int(parts[0]), int(parts[1]))
            except Exception as e:
                raise ValidationError("Invalid time format. Expected 'HH:MM'") from e
        else:
            current_user.reminder_time = payload.reminder_time

    if payload.theme is not None:
        current_user.theme = payload.theme

    await session.commit()
    await session.refresh(current_user)

    sub_count_stmt = select(func.count(PushSubscription.id)).where(
        PushSubscription.user_id == current_user.id
    )
    sub_count = (await session.execute(sub_count_stmt)).scalar_one() or 0

    return UserSettingsResponse(
        name=current_user.name,
        email=current_user.email,
        timezone=current_user.timezone,
        currency=current_user.currency,
        month_start_day=current_user.month_start_day,
        reminder_enabled=current_user.reminder_enabled,
        reminder_time=current_user.reminder_time.strftime("%H:%M"),
        theme=current_user.theme,
        has_push_subscription=sub_count > 0,
    )
