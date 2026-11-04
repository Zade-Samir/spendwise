import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.api_token import (
    ApiTokenCreatedResponse,
    ApiTokenCreateRequest,
    ApiTokenResponse,
)
from app.services.api_token_service import ApiTokenService

router = APIRouter(prefix="/api-tokens", tags=["api-tokens"])


@router.get("", response_model=list[ApiTokenResponse])
async def list_api_tokens(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[ApiTokenResponse]:
    """Lists all active (unrevoked) API tokens issued to the authenticated user."""
    return await ApiTokenService.list_tokens(session, current_user.id)


@router.post("", response_model=ApiTokenCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_token(
    payload: ApiTokenCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> ApiTokenCreatedResponse:
    """Creates a new personal API token for headless iOS Shortcuts logging.

    The plaintext token is returned only once in this response.
    """
    return await ApiTokenService.create_token(
        session=session,
        user_id=current_user.id,
        name=payload.name,
        scopes=payload.scopes,
    )


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_token(
    token_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    """Revokes an API token immediately."""
    await ApiTokenService.revoke_token(session, current_user.id, token_id)
