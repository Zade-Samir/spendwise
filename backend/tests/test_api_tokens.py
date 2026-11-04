import uuid

import pytest
from httpx import AsyncClient


async def get_auth_token(client: AsyncClient, email: str) -> tuple[str, str]:
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Token User"},
    )
    assert reg.status_code == 201, reg.text
    data = reg.json()
    return data["access_token"], data["user"]["id"]


@pytest.mark.asyncio
async def test_api_token_lifecycle(async_client: AsyncClient) -> None:
    token, _ = await get_auth_token(async_client, f"tok_test_{uuid.uuid4().hex[:8]}@spendwise.app")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create API token
    create_payload = {"name": "Siri Quick Expense", "scopes": ["transactions:create"]}
    res = await async_client.post("/api/v1/api-tokens", headers=headers, json=create_payload)
    assert res.status_code == 201
    created_data = res.json()
    assert "id" in created_data
    assert created_data["name"] == "Siri Quick Expense"
    assert created_data["token"].startswith("sw_")
    assert len(created_data["token"]) > 30
    assert created_data["last4"] == created_data["token"][-4:]
    token_id = created_data["id"]

    # 2. List tokens
    list_res = await async_client.get("/api/v1/api-tokens", headers=headers)
    assert list_res.status_code == 200
    tokens = list_res.json()
    assert len(tokens) == 1
    assert tokens[0]["id"] == token_id
    assert "token" not in tokens[0]  # Plaintext token never leaked in list
    assert tokens[0]["last4"] == created_data["last4"]

    # 3. Revoke token
    del_res = await async_client.delete(f"/api/v1/api-tokens/{token_id}", headers=headers)
    assert del_res.status_code == 204

    # 4. Verify token no longer appears in active list
    list_res_2 = await async_client.get("/api/v1/api-tokens", headers=headers)
    assert list_res_2.status_code == 200
    assert len(list_res_2.json()) == 0


@pytest.mark.asyncio
async def test_api_token_multi_tenant_isolation(async_client: AsyncClient) -> None:
    token_a, _ = await get_auth_token(async_client, f"tok_a_{uuid.uuid4().hex[:8]}@spendwise.app")
    token_b, _ = await get_auth_token(async_client, f"tok_b_{uuid.uuid4().hex[:8]}@spendwise.app")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates token
    res_a = await async_client.post(
        "/api/v1/api-tokens",
        headers=headers_a,
        json={"name": "User A Token"},
    )
    assert res_a.status_code == 201
    tok_a_id = res_a.json()["id"]

    # User B cannot see User A's token
    list_b = await async_client.get("/api/v1/api-tokens", headers=headers_b)
    assert len(list_b.json()) == 0

    # User B cannot revoke User A's token
    del_b = await async_client.delete(f"/api/v1/api-tokens/{tok_a_id}", headers=headers_b)
    assert del_b.status_code == 404
