import uuid

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import UnauthorizedError
from app.core.security import decode_access_token
from app.models.user import User
from app.services.users import get_user_by_id


async def get_current_user(
    authorization: str | None = Header(None, alias="Authorization"),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Extracts, validates, and decodes the Bearer access token to return the current user."""
    if not authorization:
        raise UnauthorizedError("Authorization header is required")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise UnauthorizedError("Invalid authorization scheme. Bearer token required")

    token = parts[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise UnauthorizedError("Invalid or expired access token")

    try:
        user_uuid = uuid.UUID(payload["sub"])
    except (ValueError, TypeError):
        raise UnauthorizedError("Malformed subject identifier in token") from None

    try:
        user = await get_user_by_id(session, user_uuid)
    except Exception:
        raise UnauthorizedError("User associated with token no longer exists") from None

    return user


async def get_current_user_or_api_token(
    authorization: str | None = Header(None, alias="Authorization"),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Authenticates either standard Bearer JWT or personal API token ('sw_...')."""
    if not authorization:
        raise UnauthorizedError("Authorization header is required")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise UnauthorizedError("Invalid authorization scheme. Bearer token required")

    raw_token = parts[1]

    # Personal API token authentication (iOS Shortcuts)
    if raw_token.startswith("sw_"):
        from app.services.api_token_service import ApiTokenService

        user_id, _ = await ApiTokenService.authenticate_token(
            session=session,
            plaintext_token=raw_token,
            required_scope="transactions:create",
        )
        return await get_user_by_id(session, user_id)

    # Standard JWT access token authentication
    payload = decode_access_token(raw_token)
    if not payload or "sub" not in payload:
        raise UnauthorizedError("Invalid or expired access token")

    try:
        user_uuid = uuid.UUID(payload["sub"])
    except (ValueError, TypeError):
        raise UnauthorizedError("Malformed subject identifier in token") from None

    try:
        user = await get_user_by_id(session, user_uuid)
    except Exception:
        raise UnauthorizedError("User associated with token no longer exists") from None

    return user
