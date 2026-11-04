import json
import logging
import uuid
from typing import Any

from pywebpush import WebPushException, webpush  # type: ignore[import-untyped]
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import PushSubscription
from app.schemas.push import PushSubscriptionCreate

logger = logging.getLogger(__name__)


class PushService:
    @staticmethod
    async def get_vapid_public_key() -> str:
        return settings.VAPID_PUBLIC_KEY

    @staticmethod
    async def subscribe(
        session: AsyncSession,
        user_id: uuid.UUID,
        payload: PushSubscriptionCreate,
    ) -> PushSubscription:
        stmt = select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
        sub = (await session.execute(stmt)).scalar_one_or_none()

        if sub:
            sub.user_id = user_id
            sub.p256dh = payload.keys.p256dh
            sub.auth = payload.keys.auth
            sub.user_agent = payload.user_agent
        else:
            sub = PushSubscription(
                user_id=user_id,
                endpoint=payload.endpoint,
                p256dh=payload.keys.p256dh,
                auth=payload.keys.auth,
                user_agent=payload.user_agent,
            )
            session.add(sub)

        await session.commit()
        await session.refresh(sub)
        return sub

    @staticmethod
    async def unsubscribe(
        session: AsyncSession,
        user_id: uuid.UUID,
        endpoint: str,
    ) -> bool:
        stmt = delete(PushSubscription).where(
            PushSubscription.user_id == user_id,
            PushSubscription.endpoint == endpoint,
        )
        res = await session.execute(stmt)
        await session.commit()
        rc = getattr(res, "rowcount", 0)
        return bool(rc and rc > 0)

    @staticmethod
    async def send_to_user(
        session: AsyncSession,
        user_id: uuid.UUID,
        title: str,
        body: str,
        url: str = "/",
        tag: str | None = None,
    ) -> tuple[int, int]:
        """Dispatches a Web Push notification to all active devices registered to user_id.

        Automatically prunes expired endpoints (404/410 Gone).
        Returns (sent_count, failed_count).
        """
        stmt = select(PushSubscription).where(PushSubscription.user_id == user_id)
        subs = (await session.execute(stmt)).scalars().all()

        if not subs:
            return 0, 0

        payload_data: dict[str, Any] = {
            "title": title,
            "body": body,
            "icon": "/icons/icon-192.png",
            "badge": "/icons/badge-72.png",
            "data": {"url": url},
        }
        if tag:
            payload_data["tag"] = tag

        payload_json = json.dumps(payload_data)
        vapid_claims = {"sub": settings.VAPID_SUBJECT}

        sent = 0
        failed = 0
        stale_endpoints: list[str] = []

        for sub in subs:
            sub_info = {
                "endpoint": sub.endpoint,
                "keys": {
                    "p256dh": sub.p256dh,
                    "auth": sub.auth,
                },
            }
            try:
                webpush(
                    subscription_info=sub_info,
                    data=payload_json,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims=vapid_claims,
                )
                sent += 1
            except WebPushException as exc:
                failed += 1
                status = getattr(exc.response, "status_code", None)
                if status in (404, 410):
                    stale_endpoints.append(sub.endpoint)
                logger.warning(
                    "WebPush dispatch error for endpoint %s: %s",
                    sub.endpoint[:40],
                    str(exc),
                )
            except Exception as exc:  # noqa: BLE001
                failed += 1
                logger.warning("Unexpected error during webpush: %s", str(exc))

        # Prune stale endpoints if any
        if stale_endpoints:
            del_stmt = delete(PushSubscription).where(
                PushSubscription.endpoint.in_(stale_endpoints)
            )
            await session.execute(del_stmt)
            await session.commit()

        return sent, failed
