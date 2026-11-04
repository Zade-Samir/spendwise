import datetime
import uuid

from httpx import AsyncClient


async def test_budget_upsert_and_retrieval(async_client: AsyncClient) -> None:
    # 1. Register user
    email = f"budget_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Budget User"},
    )
    assert reg.status_code == 201
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # 2. Get Food category
    cat_res = await async_client.get("/api/v1/categories", headers=headers)
    categories = cat_res.json()
    food_cat = next(c for c in categories if c["name"] == "Food & Dining")

    # 3. Create overall budget
    put_overall = await async_client.put(
        "/api/v1/budgets",
        headers=headers,
        json={
            "category_id": None,
            "period": "monthly",
            "amount_minor": 2500000,  # ₹25,000
            "alert_threshold_pct": 80,
        },
    )
    assert put_overall.status_code == 200
    overall_data = put_overall.json()
    assert overall_data["amount_minor"] == 2500000
    assert overall_data["category"] is None
    assert overall_data["status"] == "ok"
    assert overall_data["safe_daily_minor"] > 0

    # 4. Create category budget
    put_cat = await async_client.put(
        "/api/v1/budgets",
        headers=headers,
        json={
            "category_id": food_cat["id"],
            "period": "monthly",
            "amount_minor": 600000,  # ₹6,000
            "alert_threshold_pct": 75,
        },
    )
    assert put_cat.status_code == 200
    cat_data = put_cat.json()
    assert cat_data["amount_minor"] == 600000
    assert cat_data["category"]["id"] == food_cat["id"]
    assert cat_data["alert_threshold_pct"] == 75

    # 5. List budgets
    list_res = await async_client.get("/api/v1/budgets", headers=headers)
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["overall"] is not None
    assert body["overall"]["amount_minor"] == 2500000
    assert len(body["items"]) == 1
    assert body["items"][0]["amount_minor"] == 600000
    assert body["has_alerts"] is False
    assert body["alert_count"] == 0


async def test_budget_status_transitions_and_safe_daily(async_client: AsyncClient) -> None:
    email = f"budget_trans_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Status User"},
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    cat_res = await async_client.get("/api/v1/categories", headers=headers)
    food_cat = next(c for c in cat_res.json() if c["name"] == "Food & Dining")

    # Create category budget ₹1,000 (100,000 paise) with 80% alert threshold
    await async_client.put(
        "/api/v1/budgets",
        headers=headers,
        json={
            "category_id": food_cat["id"],
            "period": "monthly",
            "amount_minor": 100000,  # ₹1,000
            "alert_threshold_pct": 80,
        },
    )

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()

    # Step 1: Log ₹750 expense (75,000 paise) -> Status: ok (75%)
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 75000,
            "category_id": food_cat["id"],
            "occurred_at": now_iso,
        },
    )
    b_res1 = await async_client.get("/api/v1/budgets", headers=headers)
    item1 = b_res1.json()["items"][0]
    assert item1["spent_minor"] == 75000
    assert item1["remaining_minor"] == 25000
    assert item1["pct_used"] == 75.0
    assert item1["status"] == "ok"
    assert b_res1.json()["has_alerts"] is False

    # Step 2: Log ₹100 expense (10,000 paise) -> Total ₹850 (85%) -> Status: warning
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 10000,
            "category_id": food_cat["id"],
            "occurred_at": now_iso,
        },
    )
    b_res2 = await async_client.get("/api/v1/budgets", headers=headers)
    item2 = b_res2.json()["items"][0]
    assert item2["spent_minor"] == 85000
    assert item2["remaining_minor"] == 15000
    assert item2["pct_used"] == 85.0
    assert item2["status"] == "warning"
    assert b_res2.json()["has_alerts"] is True
    assert b_res2.json()["alert_count"] == 1

    # Step 3: Log ₹200 expense (20,000 paise) -> Total ₹1,050 (105%) -> Status: exceeded
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 20000,
            "category_id": food_cat["id"],
            "occurred_at": now_iso,
        },
    )
    b_res3 = await async_client.get("/api/v1/budgets", headers=headers)
    item3 = b_res3.json()["items"][0]
    assert item3["spent_minor"] == 105000
    assert item3["remaining_minor"] == 0
    assert item3["pct_used"] == 105.0
    assert item3["status"] == "exceeded"
    assert item3["safe_daily_minor"] == 0
    assert b_res3.json()["has_alerts"] is True


async def test_budget_deletion(async_client: AsyncClient) -> None:
    email = f"budget_del_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Delete User"},
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # Create budget
    b_put = await async_client.put(
        "/api/v1/budgets",
        headers=headers,
        json={
            "category_id": None,
            "period": "monthly",
            "amount_minor": 1000000,
        },
    )
    budget_id = b_put.json()["id"]

    # Delete budget
    del_res = await async_client.delete(f"/api/v1/budgets/{budget_id}", headers=headers)
    assert del_res.status_code == 204

    # Confirm deletion
    b_get = await async_client.get("/api/v1/budgets", headers=headers)
    assert b_get.json()["overall"] is None


async def test_multi_tenant_budget_isolation(async_client: AsyncClient) -> None:
    # User A
    reg_a = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": f"user_a_{uuid.uuid4().hex[:8]}@spendwise.app",
            "password": "Password123!",
            "name": "User A",
        },
    )
    headers_a = {"Authorization": f"Bearer {reg_a.json()['access_token']}"}

    b_a = await async_client.put(
        "/api/v1/budgets",
        headers=headers_a,
        json={"category_id": None, "amount_minor": 5000000},
    )
    budget_a_id = b_a.json()["id"]

    # User B
    reg_b = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": f"user_b_{uuid.uuid4().hex[:8]}@spendwise.app",
            "password": "Password123!",
            "name": "User B",
        },
    )
    headers_b = {"Authorization": f"Bearer {reg_b.json()['access_token']}"}

    # User B sees 0 budgets
    b_list_b = await async_client.get("/api/v1/budgets", headers=headers_b)
    assert b_list_b.json()["overall"] is None
    assert len(b_list_b.json()["items"]) == 0

    # User B cannot delete User A's budget
    del_res = await async_client.delete(f"/api/v1/budgets/{budget_a_id}", headers=headers_b)
    assert del_res.status_code == 404
