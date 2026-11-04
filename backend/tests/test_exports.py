import io
import uuid

import openpyxl
import pytest
from httpx import AsyncClient


async def create_user_and_categories(client: AsyncClient, email: str) -> tuple[str, str, str]:
    """Registers user and returns (token, user_id, first_category_id)."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Export User"},
    )
    assert reg.status_code == 201
    data = reg.json()
    token = data["access_token"]
    user_id = data["user"]["id"]

    # Get categories
    cats = await client.get("/api/v1/categories", headers={"Authorization": f"Bearer {token}"})
    cat_id = cats.json()[0]["id"]
    return token, user_id, cat_id


@pytest.mark.asyncio
async def test_csv_export_formula_injection_defense_and_bom(async_client: AsyncClient) -> None:
    token, _, cat_id = await create_user_and_categories(
        async_client, f"exp_formula_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Create transaction with formula injection payloads in merchant, description, notes
    malicious_payload = {
        "amount_minor": 15000,
        "category_id": cat_id,
        "merchant": "=cmd|' /C calc'!A0",
        "description": "@SUM(A1:A10)",
        "notes": "+100+200",
        "payment_method": "upi",
    }
    create_res = await async_client.post(
        "/api/v1/transactions", headers=headers, json=malicious_payload
    )
    assert create_res.status_code == 201, create_res.text

    # Request CSV export
    res = await async_client.get("/api/v1/exports/transactions.csv", headers=headers)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=" in res.headers["content-disposition"]

    content_bytes = res.content
    # 1. Assert UTF-8 Byte Order Mark (\xef\xbb\xbf)
    assert content_bytes.startswith(b"\xef\xbb\xbf")

    text = content_bytes.decode("utf-8")
    lines = text.splitlines()
    assert len(lines) >= 2

    # 2. Assert formula injection neutralization (prepended with single quote ')
    assert "'=cmd|' /C calc'!A0" in text
    assert "'@SUM(A1:A10)" in text
    assert "'+100+200" in text


@pytest.mark.asyncio
async def test_xlsx_export_multi_sheet_and_formatting(async_client: AsyncClient) -> None:
    token, _, cat_id = await create_user_and_categories(
        async_client, f"exp_xlsx_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    headers = {"Authorization": f"Bearer {token}"}

    # Create 2 transactions
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 25000,
            "category_id": cat_id,
            "merchant": "Swiggy",
            "payment_method": "upi",
        },
    )
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 15000,
            "category_id": cat_id,
            "merchant": "Zepto",
            "payment_method": "card",
        },
    )

    # Request XLSX export
    res = await async_client.get("/api/v1/exports/transactions.xlsx", headers=headers)
    assert res.status_code == 200
    assert "spreadsheetml" in res.headers["content-type"]

    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    # Assert 3 sheets exist per spec §5.2
    assert wb.sheetnames == ["Transactions", "Category Summary", "Monthly Summary"]

    # Sheet 1: Transactions
    ws1 = wb["Transactions"]
    assert ws1.cell(row=1, column=1).value == "Date"
    assert ws1.cell(row=2, column=6).value in ("Swiggy", "Zepto")

    # Sheet 2: Category Summary
    ws2 = wb["Category Summary"]
    assert ws2.cell(row=1, column=1).value == "Category"
    assert ws2.cell(row=2, column=3).value == 2  # 2 transactions total

    # Sheet 3: Monthly Summary
    ws3 = wb["Monthly Summary"]
    assert ws3.cell(row=1, column=1).value == "Month"
    assert ws3.cell(row=2, column=3).value == 2


@pytest.mark.asyncio
async def test_multi_tenant_export_isolation(async_client: AsyncClient) -> None:
    token_a, _, cat_a = await create_user_and_categories(
        async_client, f"exp_usera_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    token_b, _, cat_b = await create_user_and_categories(
        async_client, f"exp_userb_{uuid.uuid4().hex[:8]}@spendwise.app"
    )

    # User A creates secret transaction
    await async_client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"amount_minor": 999900, "category_id": cat_a, "merchant": "SecretVaultA"},
    )

    # User B creates normal transaction
    await async_client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"amount_minor": 10000, "category_id": cat_b, "merchant": "PublicTeaB"},
    )

    # User B exports CSV: User A's transaction must never appear!
    res_b = await async_client.get(
        "/api/v1/exports/transactions.csv",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b.status_code == 200
    text_b = res_b.content.decode("utf-8")
    assert "PublicTeaB" in text_b
    assert "SecretVaultA" not in text_b
