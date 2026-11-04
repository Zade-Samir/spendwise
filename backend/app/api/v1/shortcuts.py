from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_or_api_token
from app.core.db import get_db
from app.models.user import User
from app.schemas.shortcuts import (
    ShortcutTransactionRequest,
    ShortcutTransactionResponse,
)
from app.services.shortcuts import ShortcutService

router = APIRouter(prefix="/shortcuts", tags=["shortcuts"])


@router.post(
    "/transactions", response_model=ShortcutTransactionResponse, status_code=status.HTTP_201_CREATED
)
async def create_shortcut_transaction(
    payload: ShortcutTransactionRequest,
    current_user: User = Depends(get_current_user_or_api_token),
    session: AsyncSession = Depends(get_db),
) -> ShortcutTransactionResponse:
    """High-velocity endpoint designed for headless iOS Shortcuts expense creation.

    Accepts either standard Bearer JWT or personal API token ('sw_...').
    """
    return await ShortcutService.create_transaction(
        session=session,
        user_id=current_user.id,
        payload=payload,
    )
