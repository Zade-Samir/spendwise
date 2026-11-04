import datetime
import hashlib
import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, UnauthorizedError
from app.models.user import ApiToken
from app.schemas.api_token import ApiTokenCreatedResponse, ApiTokenResponse


class ApiTokenService:
    @staticmethod
    async def create_token(
        session: AsyncSession,
        user_id: uuid.UUID,
        name: str,
        scopes: list[str] | None = None,
    ) -> ApiTokenCreatedResponse:
        """Generates a secure API token prefixed with 'sw_', stores its SHA-256 hash, and returns the plaintext token once."""
        if scopes is None:
            scopes = ["transactions:create"]

        # Generate cryptographic token
        raw_secret = secrets.token_hex(24)
        token_plaintext = f"sw_{raw_secret}"
        token_hash = hashlib.sha256(token_plaintext.encode("utf-8")).hexdigest()
        last4 = token_plaintext[-4:]

        record = ApiToken(
            user_id=user_id,
            name=name.strip(),
            token_hash=token_hash,
            last4=last4,
            scopes=scopes,
        )
        session.add(record)
        await session.commit()
        await session.refresh(record)

        return ApiTokenCreatedResponse(
            id=record.id,
            name=record.name,
            token=token_plaintext,
            last4=record.last4,
            scopes=record.scopes,
            created_at=record.created_at,
        )

    @staticmethod
    async def list_tokens(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[ApiTokenResponse]:
        """Lists all active (unrevoked) API tokens for the given user."""
        stmt = (
            select(ApiToken)
            .where(ApiToken.user_id == user_id, ApiToken.revoked_at.is_(None))
            .order_by(ApiToken.created_at.desc())
        )
        tokens = (await session.execute(stmt)).scalars().all()
        return [ApiTokenResponse.model_validate(t) for t in tokens]

    @staticmethod
    async def revoke_token(
        session: AsyncSession,
        user_id: uuid.UUID,
        token_id: uuid.UUID,
    ) -> None:
        """Revokes an active API token."""
        stmt = select(ApiToken).where(
            ApiToken.id == token_id,
            ApiToken.user_id == user_id,
            ApiToken.revoked_at.is_(None),
        )
        token = (await session.execute(stmt)).scalar_one_or_none()
        if not token:
            raise NotFoundError("API token not found or already revoked")

        token.revoked_at = datetime.datetime.now(datetime.UTC)
        await session.commit()

    @staticmethod
    async def authenticate_token(
        session: AsyncSession,
        plaintext_token: str,
        required_scope: str = "transactions:create",
    ) -> tuple[uuid.UUID, ApiToken]:
        """Validates a plaintext API token, updates last_used_at, and verifies required scope."""
        if not plaintext_token.startswith("sw_"):
            raise UnauthorizedError("Invalid token format")

        token_hash = hashlib.sha256(plaintext_token.encode("utf-8")).hexdigest()
        stmt = select(ApiToken).where(
            ApiToken.token_hash == token_hash,
            ApiToken.revoked_at.is_(None),
        )
        token = (await session.execute(stmt)).scalar_one_or_none()
        if not token:
            raise UnauthorizedError("Invalid or revoked API token")

        if required_scope not in token.scopes:
            raise UnauthorizedError(f"Token lacks required scope '{required_scope}'")

        token.last_used_at = datetime.datetime.now(datetime.UTC)
        await session.commit()

        return token.user_id, token
