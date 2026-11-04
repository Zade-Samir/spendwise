import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ConflictError, UnauthorizedError, ValidationError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    validate_password_strength,
    verify_password,
)
from app.models.user import RefreshToken, User
from app.services.seed import seed_user_defaults


async def register_user(
    session: AsyncSession,
    email: str,
    password: str,
    name: str | None = None,
    user_agent: str | None = None,
) -> tuple[User, str, str]:
    """Registers a new user, hashes password, seeds default categories/rules, and issues tokens."""
    is_valid, err_msg = validate_password_strength(password)
    if not is_valid:
        raise ValidationError(
            message=err_msg or "Password does not meet security requirements",
            fields={"password": err_msg or "Invalid password"},
        )

    clean_email = email.strip().lower()
    existing_user_stmt = select(User).where(User.email == clean_email)
    existing_user_res = await session.execute(existing_user_stmt)
    if existing_user_res.scalar_one_or_none() is not None:
        raise ConflictError(message="A user with this email address already exists")

    hashed_pw = hash_password(password)
    user = User(
        email=clean_email,
        password_hash=hashed_pw,
        name=name.strip() if name else None,
    )
    session.add(user)
    await session.flush()  # populate user.id

    # Seed default categories and categorization rules
    await seed_user_defaults(session, user.id)

    # Issue tokens
    access_token = create_access_token(user.id)
    raw_refresh_token = generate_refresh_token()
    token_hash = hash_token(raw_refresh_token)

    now = datetime.datetime.now(datetime.UTC)
    expires_at = now + datetime.timedelta(days=settings.REFRESH_TOKEN_DAYS)

    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=user_agent,
    )
    session.add(refresh_token_record)
    await session.commit()
    await session.refresh(user)

    return user, access_token, raw_refresh_token


async def authenticate_user(
    session: AsyncSession,
    email: str,
    password: str,
    user_agent: str | None = None,
) -> tuple[User, str, str]:
    """Authenticates user credentials and issues a fresh token pair."""
    clean_email = email.strip().lower()
    stmt = select(User).where(User.email == clean_email)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash):
        raise UnauthorizedError(message="Invalid email or password")

    access_token = create_access_token(user.id)
    raw_refresh_token = generate_refresh_token()
    token_hash = hash_token(raw_refresh_token)

    now = datetime.datetime.now(datetime.UTC)
    expires_at = now + datetime.timedelta(days=settings.REFRESH_TOKEN_DAYS)

    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=user_agent,
    )
    session.add(refresh_token_record)
    await session.commit()
    await session.refresh(user)

    return user, access_token, raw_refresh_token


async def rotate_refresh_token(
    session: AsyncSession,
    raw_refresh_token: str,
    user_agent: str | None = None,
) -> tuple[str, str]:
    """Rotates refresh token with reuse-detection. Revokes compromised sessions on reuse."""
    token_hash = hash_token(raw_refresh_token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    res = await session.execute(stmt)
    token_record = res.scalar_one_or_none()

    if not token_record:
        raise UnauthorizedError(message="Invalid refresh token")

    now = datetime.datetime.now(datetime.UTC)

    # Automatic Breach Neutralization: Token Reuse Detected
    if token_record.revoked_at is not None:
        # Revoke all tokens for this user
        revoke_all_stmt = (
            update(RefreshToken)
            .where(RefreshToken.user_id == token_record.user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await session.execute(revoke_all_stmt)
        await session.commit()
        raise UnauthorizedError(message="Refresh token reuse detected; all sessions terminated")

    # Check expiration
    if token_record.expires_at < now:
        token_record.revoked_at = now
        await session.commit()
        raise UnauthorizedError(message="Refresh token has expired")

    # Mark current token revoked
    token_record.revoked_at = now

    # Issue new refresh token & access token
    new_raw_refresh_token = generate_refresh_token()
    new_token_hash = hash_token(new_raw_refresh_token)
    expires_at = now + datetime.timedelta(days=settings.REFRESH_TOKEN_DAYS)

    new_record = RefreshToken(
        user_id=token_record.user_id,
        token_hash=new_token_hash,
        expires_at=expires_at,
        user_agent=user_agent,
    )
    session.add(new_record)

    access_token = create_access_token(token_record.user_id)
    await session.commit()

    return access_token, new_raw_refresh_token


async def revoke_refresh_token(
    session: AsyncSession,
    raw_refresh_token: str,
) -> None:
    """Revokes the specified refresh token upon logout."""
    token_hash = hash_token(raw_refresh_token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    res = await session.execute(stmt)
    token_record = res.scalar_one_or_none()

    if token_record and token_record.revoked_at is None:
        token_record.revoked_at = datetime.datetime.now(datetime.UTC)
        await session.commit()
