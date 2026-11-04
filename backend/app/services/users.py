import datetime
import uuid
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, UnauthorizedError, ValidationError
from app.core.security import (
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.models.enums import PaymentMethod
from app.models.user import RefreshToken, User


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User:
    """Fetches user by primary key. Raises NotFoundError if not found."""
    stmt = select(User).where(User.id == user_id)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise NotFoundError("User not found")
    return user


async def update_user_preferences(
    session: AsyncSession,
    user: User,
    update_data: dict[str, Any],
) -> User:
    """Updates user-level profile and preference settings."""
    if "name" in update_data:
        user.name = update_data["name"]
    if "timezone" in update_data and update_data["timezone"]:
        user.timezone = update_data["timezone"]
    if "currency" in update_data and update_data["currency"]:
        user.currency = update_data["currency"]
    if "week_start" in update_data and update_data["week_start"] is not None:
        if not (1 <= update_data["week_start"] <= 7):
            raise ValidationError(
                "week_start must be between 1 and 7", fields={"week_start": "Between 1 and 7"}
            )
        user.week_start = update_data["week_start"]
    if "month_start_day" in update_data and update_data["month_start_day"] is not None:
        if not (1 <= update_data["month_start_day"] <= 28):
            raise ValidationError(
                "month_start_day must be between 1 and 28",
                fields={"month_start_day": "Between 1 and 28"},
            )
        user.month_start_day = update_data["month_start_day"]
    if "default_payment_method" in update_data and update_data["default_payment_method"]:
        val = update_data["default_payment_method"]
        user.default_payment_method = PaymentMethod(val) if isinstance(val, str) else val
    if "reminder_enabled" in update_data and update_data["reminder_enabled"] is not None:
        user.reminder_enabled = bool(update_data["reminder_enabled"])
    if "reminder_time" in update_data and update_data["reminder_time"] is not None:
        user.reminder_time = update_data["reminder_time"]
    if "theme" in update_data and update_data["theme"]:
        if update_data["theme"] not in ("system", "light", "dark"):
            raise ValidationError(
                "theme must be 'system', 'light', or 'dark'", fields={"theme": "Invalid theme"}
            )
        user.theme = update_data["theme"]

    await session.commit()
    await session.refresh(user)
    return user


async def change_user_password(
    session: AsyncSession,
    user: User,
    current_password: str,
    new_password: str,
) -> None:
    """Changes user password and invalidates all existing refresh tokens."""
    if not verify_password(current_password, user.password_hash):
        raise UnauthorizedError("Incorrect current password")

    is_valid, err_msg = validate_password_strength(new_password)
    if not is_valid:
        raise ValidationError(
            message=err_msg or "New password does not meet security requirements",
            fields={"new_password": err_msg or "Invalid password"},
        )

    user.password_hash = hash_password(new_password)

    # Invalidate all active refresh tokens to force re-login on all devices
    now = datetime.datetime.now(datetime.UTC)
    revoke_stmt = (
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    await session.execute(revoke_stmt)
    await session.commit()


async def delete_user_account(
    session: AsyncSession,
    user: User,
    password: str,
) -> None:
    """Verifies password and cascades hard deletion across all user data."""
    if not verify_password(password, user.password_hash):
        raise UnauthorizedError("Incorrect password")

    await session.delete(user)
    await session.commit()
