from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.push import (
    PushSubscriptionCreate,
    PushSubscriptionDelete,
    PushTestResponse,
    VapidPublicKeyResponse,
)
from app.services.push_service import PushService

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse)
async def get_vapid_public_key() -> VapidPublicKeyResponse:
    """Returns the application VAPID public key for Web Push subscription."""
    key = await PushService.get_vapid_public_key()
    return VapidPublicKeyResponse(public_key=key)


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe_push(
    payload: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Registers or updates a browser Web Push subscription for the authenticated user."""
    await PushService.subscribe(session, current_user.id, payload)
    return {"status": "subscribed"}


@router.delete("/subscribe", status_code=status.HTTP_200_OK)
async def unsubscribe_push(
    payload: PushSubscriptionDelete,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Removes a browser Web Push subscription."""
    await PushService.unsubscribe(session, current_user.id, payload.endpoint)
    return {"status": "unsubscribed"}


@router.post("/test", response_model=PushTestResponse)
async def test_push(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> PushTestResponse:
    """Dispatches an immediate test push notification to all active devices registered to the user."""
    sent, failed = await PushService.send_to_user(
        session=session,
        user_id=current_user.id,
        title="SpendWise Notification Test",
        body="Web Push is active and working properly on your device!",
        url="/",
        tag="test_push",
    )
    return PushTestResponse(sent=sent, failed=failed)

