import io
import uuid

import pytest
from httpx import AsyncClient

# Sample bank statements
HDFC_CSV = """Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amt,Deposit Amt,Closing Balance
02/11/2026,UPI-SWIGGY-123456@icici,6308129,02/11/2026,240.00,,48200.50
02/11/2026,SALARY CREDIT NOV 2026,9876543,02/11/2026,,85000.00,133200.50
03/11/2026,UPI-UBER-789012@axis,6308130,03/11/2026,350.50,,132850.00
"""

SBI_CSV = """Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
02 Nov 2026,02 Nov 2026,UPI/ZOMATO/ORDER987,REF001,450.00,,12000.00
03 Nov 2026,03 Nov 2026,INTEREST CREDIT,REF002,,120.00,12120.00
04 Nov 2026,04 Nov 2026,NEFT-AIRTEL BROADBAND,REF003,999.00,,11121.00
"""

SINGLE_COLUMN_CSV = """Date,Description,Amount
2026-11-01,Netflix Subscription,-499.00
2026-11-02,Cashback Bonus,50.00
2026-11-03,Saravana Bhavan,-280.00
"""


async def get_auth_token(client: AsyncClient, email: str) -> tuple[str, str]:
    """Helper to register and login a test user, returning (token, user_id)."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Import Test User"},
    )
    assert reg.status_code == 201, reg.text
    data = reg.json()
    return data["access_token"], data["user"]["id"]


@pytest.mark.asyncio
async def test_csv_upload_sniffing_and_dialects(async_client: AsyncClient) -> None:
    token, _ = await get_auth_token(async_client, f"imp_sniff_{uuid.uuid4().hex[:8]}@spendwise.app")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Upload HDFC format
    files = {"file": ("hdfc.csv", io.BytesIO(HDFC_CSV.encode("utf-8")), "text/csv")}
    res = await async_client.post("/api/v1/imports", headers=headers, files=files)
    assert res.status_code == 200, res.text
    data = res.json()
    assert "batch_id" in data
    assert data["detected"]["delimiter"] == ","
    assert data["detected"]["date_format"] == "DD/MM/YYYY"
    assert data["suggested_mapping"]["date"] == "Date"
    assert data["suggested_mapping"]["description"] == "Narration"
    assert data["suggested_mapping"]["debit"] == "Withdrawal Amt"

    # 2. Upload SBI format (DD MMM YYYY)
    files = {"file": ("sbi.csv", io.BytesIO(SBI_CSV.encode("utf-8")), "text/csv")}
    res_sbi = await async_client.post("/api/v1/imports", headers=headers, files=files)
    assert res_sbi.status_code == 200, res_sbi.text
    data_sbi = res_sbi.json()
    assert data_sbi["detected"]["date_format"] == "DD MMM YYYY"
    assert data_sbi["suggested_mapping"]["debit"] == "Debit"


@pytest.mark.asyncio
async def test_csv_preview_and_duplicate_detection(async_client: AsyncClient) -> None:
    token, _ = await get_auth_token(async_client, f"imp_dupe_{uuid.uuid4().hex[:8]}@spendwise.app")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload HDFC CSV
    files = {"file": ("hdfc.csv", io.BytesIO(HDFC_CSV.encode("utf-8")), "text/csv")}
    up = await async_client.post("/api/v1/imports", headers=headers, files=files)
    batch_id = up.json()["batch_id"]

    # Preview
    preview_req = {
        "mapping": {
            "date": "Date",
            "description": "Narration",
            "debit": "Withdrawal Amt",
            "credit": "Deposit Amt",
        },
        "date_format": "DD/MM/YYYY",
        "amount_mode": "debit_credit",
        "skip_credits": True,
    }
    prev_res = await async_client.post(
        f"/api/v1/imports/{batch_id}/preview", headers=headers, json=preview_req
    )
    assert prev_res.status_code == 200, prev_res.text
    prev_data = prev_res.json()

    # Credits skipped: 2 debits (Swiggy ₹240.00, Uber ₹350.50)
    assert prev_data["stats"]["total"] == 2
    assert prev_data["stats"]["duplicates"] == 0
    assert prev_data["rows"][0]["amount_minor"] == 24000
    assert prev_data["rows"][1]["amount_minor"] == 35050

    # Commit batch
    commit_req = {
        "rows": [
            {"row_no": r["row_no"], "category_id": r["suggested_category_id"], "include": True}
            for r in prev_data["rows"]
        ],
        "skip_duplicates": True,
    }
    com_res = await async_client.post(
        f"/api/v1/imports/{batch_id}/commit", headers=headers, json=commit_req
    )
    assert com_res.status_code == 200, com_res.text
    assert com_res.json()["imported"] == 2

    # Re-upload the exact same CSV as a second batch
    up2 = await async_client.post("/api/v1/imports", headers=headers, files=files)
    batch_id_2 = up2.json()["batch_id"]

    # Preview second batch: Should detect both rows as duplicates!
    prev2_res = await async_client.post(
        f"/api/v1/imports/{batch_id_2}/preview", headers=headers, json=preview_req
    )
    assert prev2_res.status_code == 200, prev2_res.text
    prev2_data = prev2_res.json()
    assert prev2_data["stats"]["duplicates"] == 2
    assert prev2_data["rows"][0]["is_duplicate"] is True
    assert prev2_data["rows"][1]["is_duplicate"] is True


@pytest.mark.asyncio
async def test_single_column_signed_import(async_client: AsyncClient) -> None:
    token, _ = await get_auth_token(
        async_client, f"imp_single_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    headers = {"Authorization": f"Bearer {token}"}

    files = {"file": ("single.csv", io.BytesIO(SINGLE_COLUMN_CSV.encode("utf-8")), "text/csv")}
    up = await async_client.post("/api/v1/imports", headers=headers, files=files)
    batch_id = up.json()["batch_id"]

    preview_req = {
        "mapping": {
            "date": "Date",
            "description": "Description",
            "amount": "Amount",
        },
        "date_format": "YYYY-MM-DD",
        "amount_mode": "single_column",
        "skip_credits": True,
    }
    prev_res = await async_client.post(
        f"/api/v1/imports/{batch_id}/preview", headers=headers, json=preview_req
    )
    assert prev_res.status_code == 200, prev_res.text
    rows = prev_res.json()["rows"]
    # 2 debits (Netflix ₹499.00 and Saravana Bhavan ₹280.00), credit ₹50 skipped
    assert len(rows) == 2
    assert rows[0]["amount_minor"] == 49900
    assert rows[1]["amount_minor"] == 28000


@pytest.mark.asyncio
async def test_undo_import_batch(async_client: AsyncClient) -> None:
    token, _ = await get_auth_token(async_client, f"imp_undo_{uuid.uuid4().hex[:8]}@spendwise.app")
    headers = {"Authorization": f"Bearer {token}"}

    files = {"file": ("hdfc.csv", io.BytesIO(HDFC_CSV.encode("utf-8")), "text/csv")}
    up = await async_client.post("/api/v1/imports", headers=headers, files=files)
    batch_id = up.json()["batch_id"]

    preview_req = {
        "mapping": {
            "date": "Date",
            "description": "Narration",
            "debit": "Withdrawal Amt",
            "credit": "Deposit Amt",
        },
        "date_format": "DD/MM/YYYY",
        "amount_mode": "debit_credit",
        "skip_credits": True,
    }
    prev_res = await async_client.post(
        f"/api/v1/imports/{batch_id}/preview", headers=headers, json=preview_req
    )
    prev_rows = prev_res.json()["rows"]

    # Commit
    commit_req = {
        "rows": [
            {"row_no": r["row_no"], "category_id": r["suggested_category_id"], "include": True}
            for r in prev_rows
        ],
        "skip_duplicates": True,
    }
    await async_client.post(f"/api/v1/imports/{batch_id}/commit", headers=headers, json=commit_req)

    # Verify transactions appear in transactions list
    tx_list = await async_client.get("/api/v1/transactions", headers=headers)
    assert tx_list.json()["totals"]["count"] == 2

    # Undo Import: DELETE /api/v1/imports/{batch_id}
    del_res = await async_client.delete(f"/api/v1/imports/{batch_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify transactions are reversed (soft-deleted)
    tx_list_after = await async_client.get("/api/v1/transactions", headers=headers)
    assert tx_list_after.json()["totals"]["count"] == 0


@pytest.mark.asyncio
async def test_multi_tenant_import_isolation(async_client: AsyncClient) -> None:
    token_a, _ = await get_auth_token(
        async_client, f"imp_user_a_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    token_b, _ = await get_auth_token(
        async_client, f"imp_user_b_{uuid.uuid4().hex[:8]}@spendwise.app"
    )

    # User A uploads batch
    files = {"file": ("hdfc.csv", io.BytesIO(HDFC_CSV.encode("utf-8")), "text/csv")}
    up_a = await async_client.post(
        "/api/v1/imports", headers={"Authorization": f"Bearer {token_a}"}, files=files
    )
    batch_a_id = up_a.json()["batch_id"]

    # User B cannot preview User A's batch
    preview_req = {
        "mapping": {"date": "Date", "description": "Narration", "debit": "Withdrawal Amt"},
        "date_format": "DD/MM/YYYY",
        "amount_mode": "debit_credit",
        "skip_credits": True,
    }
    b_prev = await async_client.post(
        f"/api/v1/imports/{batch_a_id}/preview",
        headers={"Authorization": f"Bearer {token_b}"},
        json=preview_req,
    )
    assert b_prev.status_code == 404

    # User B cannot undo User A's batch
    b_del = await async_client.delete(
        f"/api/v1/imports/{batch_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert b_del.status_code == 404
