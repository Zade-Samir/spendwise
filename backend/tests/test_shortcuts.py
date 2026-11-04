import uuid

import pytest
from httpx import AsyncClient


async def create_user_with_token(client: AsyncClient, email: str) -> tuple[str, str, str]:
    """Registers user and creates a personal API token, returning (jwt, api_token, user_id)."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Shortcut Tester"},
    )
    assert reg.status_code == 201
    jwt_token = reg.json()["access_token"]
    user_id = reg.json()["user"]["id"]

    # Issue API token
    tok_res = await client.post(
        "/api/v1/api-tokens",
        headers={"Authorization": f"Bearer {jwt_token}"},
        json={"name": "iPhone Shortcut"},
    )
    assert tok_res.status_code == 201
    api_token = tok_res.json()["token"]

    return jwt_token, api_token, user_id


@pytest.mark.asyncio
async def test_shortcut_transaction_via_api_token(async_client: AsyncClient) -> None:
    _, api_token, _ = await create_user_with_token(
        async_client, f"short_tok_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    headers = {"Authorization": f"Bearer {api_token}"}

    payload = {
        "amount": "150.50",
        "category": "Food & Dining",
        "merchant": "Saravana Bhavan",
        "payment_method": "upi",
        "note": "South Indian Breakfast",
    }

    res = await async_client.post("/api/v1/shortcuts/transactions", headers=headers, json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["amount_minor"] == 15050
    assert data["merchant"] == "Saravana Bhavan"
    assert data["payment_method"] == "upi"
    assert data["source"] == "shortcut"
    assert "Food" in data["category_name"]


@pytest.mark.asyncio
async def test_shortcut_amount_parsing_and_fallback_category(async_client: AsyncClient) -> None:
    jwt_token, _, _ = await create_user_with_token(
        async_client, f"short_parse_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    headers = {"Authorization": f"Bearer {jwt_token}"}

    # Amount with currency symbol and unknown category (should fallback to default category)
    payload = {
        "amount": "₹ 450",
        "category": "NonExistentCategoryName123",
        "merchant": "Uber",
    }

    res = await async_client.post("/api/v1/shortcuts/transactions", headers=headers, json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["amount_minor"] == 45000
    assert data["merchant"] == "Uber"
    assert data["category_name"] != ""  # Successfully fell back to an existing category


@pytest.mark.asyncio
async def test_shortcut_revoked_or_invalid_token(async_client: AsyncClient) -> None:
    jwt_token, api_token, _ = await create_user_with_token(
        async_client, f"short_rev_{uuid.uuid4().hex[:8]}@spendwise.app"
    )

    # 1. Invalid token string
    bad_res = await async_client.post(
        "/api/v1/shortcuts/transactions",
        headers={"Authorization": "Bearer sw_invalid1234567890abcdef1234567890abcdef"},
        json={"amount": "100"},
    )
    assert bad_res.status_code == 401

    # 2. Get token ID and revoke it
    tok_list = await async_client.get(
        "/api/v1/api-tokens",
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    token_id = tok_list.json()[0]["id"]

    await async_client.delete(
        f"/api/v1/api-tokens/{token_id}",
        headers={"Authorization": f"Bearer {jwt_token}"},
    )

    # 3. Attempt creation with revoked token -> must fail 401
    rev_res = await async_client.post(
        "/api/v1/shortcuts/transactions",
        headers={"Authorization": f"Bearer {api_token}"},
        json={"amount": "100"},
    )
    assert rev_res.status_code == 401
