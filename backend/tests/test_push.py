import uuid
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient


async def get_auth_token(client: AsyncClient, email: str) -> tuple[str, str]:
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Push User"},
    )
    assert reg.status_code == 201, reg.text
    data = reg.json()
    return data["access_token"], data["user"]["id"]


@pytest.mark.asyncio
async def test_get_vapid_public_key(async_client: AsyncClient) -> None:
    res = await async_client.get("/api/v1/push/vapid-public-key")
    assert res.status_code == 200
    data = res.json()
    assert "public_key" in data
    assert len(data["public_key"]) > 20


@pytest.mark.asyncio
async def test_push_subscribe_and_unsubscribe(async_client: AsyncClient) -> None:
    token, _ = await get_auth_token(async_client, f"push_sub_{uuid.uuid4().hex[:8]}@spendwise.app")
    headers = {"Authorization": f"Bearer {token}"}

    sub_payload = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/sample-token-123",
        "keys": {
            "p256dh": "sample_p256dh_key_base64url",
            "auth": "sample_auth_secret",
        },
        "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    }

    # 1. Subscribe
    sub_res = await async_client.post("/api/v1/push/subscribe", headers=headers, json=sub_payload)
    assert sub_res.status_code == 201
    assert sub_res.json()["status"] == "subscribed"

    # 2. Re-subscribe with updated keys (upsert idempotency)
    sub_payload["keys"]["p256dh"] = "updated_p256dh_key"
    sub_res_2 = await async_client.post("/api/v1/push/subscribe", headers=headers, json=sub_payload)
    assert sub_res_2.status_code == 201

    # 3. Unsubscribe
    unsub_res = await async_client.request(
        "DELETE",
        "/api/v1/push/subscribe",
        headers=headers,
        json={"endpoint": sub_payload["endpoint"]},
    )
    assert unsub_res.status_code == 200
    assert unsub_res.json()["status"] == "unsubscribed"


@pytest.mark.asyncio
async def test_push_test_dispatch(async_client: AsyncClient) -> None:
    token, _ = await get_auth_token(async_client, f"push_test_{uuid.uuid4().hex[:8]}@spendwise.app")
    headers = {"Authorization": f"Bearer {token}"}

    # Register subscription first
    sub_payload = {
        "endpoint": "https://web.push.apple.com/sample-endpoint-456",
        "keys": {
            "p256dh": "sample_p256dh_key",
            "auth": "sample_auth_key",
        },
    }
    await async_client.post("/api/v1/push/subscribe", headers=headers, json=sub_payload)

    # Mock webpush to avoid real APNs call
    with patch("app.services.push_service.webpush", return_value=MagicMock()):
        test_res = await async_client.post("/api/v1/push/test", headers=headers)
        assert test_res.status_code == 200
        data = test_res.json()
        assert data["sent"] == 1
        assert data["failed"] == 0
