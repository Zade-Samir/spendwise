import datetime
import uuid

from httpx import AsyncClient


async def test_insights_empty_state_and_degradation(async_client: AsyncClient) -> None:
    # 1. Register new user without any transactions
    email = f"insights_empty_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Empty User"},
    )
    assert reg.status_code == 201
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # 2. Call GET /api/v1/insights
    res = await async_client.get("/api/v1/insights", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["items"] == []  # Clean empty state degradation


async def test_insights_top_category_and_largest_expense(async_client: AsyncClient) -> None:
    email = f"insights_rules_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Rules User"},
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    cat_res = await async_client.get("/api/v1/categories", headers=headers)
    food_cat = next(c for c in cat_res.json() if c["name"] == "Food & Dining")
    transport_cat = next(c for c in cat_res.json() if c["name"] == "Transportation")

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()

    # Log 5 food expenses and 1 large transport expense
    for i in range(5):
        await async_client.post(
            "/api/v1/transactions",
            headers=headers,
            json={
                "amount_minor": 15000 + (i * 1000),  # ₹150 - ₹190
                "category_id": food_cat["id"],
                "merchant": f"Cafe {i}",
                "occurred_at": now_iso,
            },
        )

    # Largest expense: Croma Electronics ₹8,500
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 850000,
            "category_id": transport_cat["id"],
            "merchant": "Croma",
            "occurred_at": now_iso,
        },
    )

    res = await async_client.get("/api/v1/insights", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) >= 2

    # Check largest_expense
    largest = next((it for it in items if it["kind"] == "largest_expense"), None)
    assert largest is not None
    assert "₹8,500" in largest["body"]
    assert "Croma" in largest["body"]

    # Check top_category
    top_cat = next((it for it in items if it["kind"] == "top_category"), None)
    assert top_cat is not None
    assert "Transportation" in top_cat["body"] or "Food & Dining" in top_cat["body"]


async def test_insights_budget_warning_and_isolation(async_client: AsyncClient) -> None:
    # User A
    email_a = f"insights_a_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg_a = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email_a, "password": "Password123!", "name": "User A"},
    )
    headers_a = {"Authorization": f"Bearer {reg_a.json()['access_token']}"}

    cat_res = await async_client.get("/api/v1/categories", headers=headers_a)
    food_cat = next(c for c in cat_res.json() if c["name"] == "Food & Dining")

    # Set budget of ₹1,000 with 80% threshold
    await async_client.put(
        "/api/v1/budgets",
        headers=headers_a,
        json={
            "category_id": food_cat["id"],
            "period": "monthly",
            "amount_minor": 100000,
            "alert_threshold_pct": 80,
        },
    )

    # Spend ₹900 (90%)
    await async_client.post(
        "/api/v1/transactions",
        headers=headers_a,
        json={
            "amount_minor": 90000,
            "category_id": food_cat["id"],
            "occurred_at": datetime.datetime.now(datetime.UTC).isoformat(),
        },
    )

    res_a = await async_client.get("/api/v1/insights", headers=headers_a)
    assert res_a.status_code == 200
    items_a = res_a.json()["items"]
    b_warn = next((it for it in items_a if it["kind"] == "budget_warning"), None)
    assert b_warn is not None
    assert b_warn["severity"] == "warning"
    assert "Food & Dining" in b_warn["body"]
    assert "90%" in b_warn["body"]

    # User B has zero data and should see 0 insights
    email_b = f"insights_b_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg_b = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email_b, "password": "Password123!", "name": "User B"},
    )
    headers_b = {"Authorization": f"Bearer {reg_b.json()['access_token']}"}

    res_b = await async_client.get("/api/v1/insights", headers=headers_b)
    assert res_b.status_code == 200
    assert res_b.json()["items"] == []
