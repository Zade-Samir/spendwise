import datetime
import uuid

from httpx import AsyncClient


async def test_analytics_summary_and_reconciliation(async_client: AsyncClient) -> None:
    # 1. Register user
    email = f"analytics_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Analytics User"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Fetch seeded categories
    cat_res = await async_client.get("/api/v1/categories", headers=headers)
    assert cat_res.status_code == 200
    categories = cat_res.json()
    food_cat = next(c for c in categories if c["name"] == "Food & Dining")
    transport_cat = next(c for c in categories if c["name"] == "Transportation")

    # 3. Create transactions
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 15000,
            "category_id": food_cat["id"],
            "merchant": "Swiggy",
            "payment_method": "upi",
            "occurred_at": now_iso,
        },
    )
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 25000,
            "category_id": food_cat["id"],
            "merchant": "Zomato",
            "payment_method": "upi",
            "occurred_at": now_iso,
        },
    )
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 10000,
            "category_id": transport_cat["id"],
            "merchant": "Uber",
            "payment_method": "card",
            "occurred_at": now_iso,
        },
    )

    # 4. GET /analytics/summary
    summary_res = await async_client.get("/api/v1/analytics/summary", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()

    assert summary["today"]["sum_minor"] == 50000
    assert summary["today"]["count"] == 3
    assert summary["month"]["sum_minor"] == 50000
    assert summary["month"]["count"] == 3
    assert summary["avg_daily_minor"] > 0
    assert summary["projected_month_minor"] > 0

    # 5. GET /analytics/by-category and test mathematical reconciliation
    by_cat_res = await async_client.get("/api/v1/analytics/by-category", headers=headers)
    assert by_cat_res.status_code == 200
    by_cat = by_cat_res.json()

    assert by_cat["total_minor"] == 50000
    assert len(by_cat["items"]) == 2

    # Check category percentages and order
    food_item = next(item for item in by_cat["items"] if item["category_id"] == food_cat["id"])
    transport_item = next(
        item for item in by_cat["items"] if item["category_id"] == transport_cat["id"]
    )

    assert food_item["sum_minor"] == 40000
    assert food_item["count"] == 2
    assert food_item["pct"] == 80.0

    assert transport_item["sum_minor"] == 10000
    assert transport_item["count"] == 1
    assert transport_item["pct"] == 20.0

    # Mathematical reconciliation invariant
    assert sum(item["sum_minor"] for item in by_cat["items"]) == summary["month"]["sum_minor"]


async def test_analytics_trend_zero_filling(async_client: AsyncClient) -> None:
    email = f"trend_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Trend User"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    cat_res = await async_client.get("/api/v1/categories", headers=headers)
    cat_id = cat_res.json()[0]["id"]

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 18000,
            "category_id": cat_id,
            "merchant": "Cafe",
            "payment_method": "cash",
            "occurred_at": now_iso,
        },
    )

    trend_res = await async_client.get("/api/v1/analytics/trend?period=month", headers=headers)
    assert trend_res.status_code == 200
    trend = trend_res.json()

    # The month should have between 28 and 31 points (zero-filled for all days)
    assert 28 <= len(trend["points"]) <= 31

    # At least one point has 18000
    active_points = [p for p in trend["points"] if p["sum_minor"] > 0]
    assert len(active_points) >= 1
    assert sum(p["sum_minor"] for p in trend["points"]) == 18000

    # Missing days must be zero-filled
    zero_points = [p for p in trend["points"] if p["sum_minor"] == 0]
    assert len(zero_points) >= 27
    for zp in zero_points:
        assert zp["count"] == 0


async def test_analytics_payment_method_and_top_merchants(async_client: AsyncClient) -> None:
    email = f"pm_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "PM User"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    cat_res = await async_client.get("/api/v1/categories", headers=headers)
    cat_id = cat_res.json()[0]["id"]

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 30000,
            "category_id": cat_id,
            "merchant": "Amazon",
            "payment_method": "upi",
            "occurred_at": now_iso,
        },
    )
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 10000,
            "category_id": cat_id,
            "merchant": "Amazon",
            "payment_method": "card",
            "occurred_at": now_iso,
        },
    )
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 10000,
            "category_id": cat_id,
            "merchant": "Blinkit",
            "payment_method": "cash",
            "occurred_at": now_iso,
        },
    )

    # By Payment Method
    pm_res = await async_client.get("/api/v1/analytics/by-payment-method", headers=headers)
    assert pm_res.status_code == 200
    pm_data = pm_res.json()
    assert len(pm_data["items"]) == 3
    upi_item = next(i for i in pm_data["items"] if i["payment_method"] == "upi")
    assert upi_item["sum_minor"] == 30000
    assert upi_item["pct"] == 60.0

    # Top Merchants
    tm_res = await async_client.get("/api/v1/analytics/top-merchants?limit=5", headers=headers)
    assert tm_res.status_code == 200
    tm_data = tm_res.json()
    assert len(tm_data["items"]) == 2
    assert tm_data["items"][0]["merchant"] == "Amazon"
    assert tm_data["items"][0]["sum_minor"] == 40000
    assert tm_data["items"][1]["merchant"] == "Blinkit"
    assert tm_data["items"][1]["sum_minor"] == 10000


async def test_analytics_compare_and_heatmap(async_client: AsyncClient) -> None:
    email = f"comp_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Comp User"},
    )
    assert reg.status_code == 201
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    cat_res = await async_client.get("/api/v1/categories", headers=headers)
    cat_id = cat_res.json()[0]["id"]

    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    await async_client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "amount_minor": 20000,
            "category_id": cat_id,
            "merchant": "Store",
            "payment_method": "upi",
            "occurred_at": now_iso,
        },
    )

    # Compare
    comp_res = await async_client.get("/api/v1/analytics/compare?period=month", headers=headers)
    assert comp_res.status_code == 200
    comp = comp_res.json()
    assert comp["current_minor"] == 20000
    assert comp["delta_minor"] == 20000

    # Heatmap
    hm_res = await async_client.get("/api/v1/analytics/heatmap?period=month", headers=headers)
    assert hm_res.status_code == 200
    hm = hm_res.json()
    assert len(hm["points"]) >= 28
    active_hm = [p for p in hm["points"] if p["level"] > 0]
    assert len(active_hm) >= 1
    assert active_hm[0]["level"] == 4  # single max spend


async def test_multi_tenant_analytics_isolation(async_client: AsyncClient) -> None:
    # User A
    email_a = f"tenant_a_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg_a = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email_a, "password": "Password123!", "name": "User A"},
    )
    assert reg_a.status_code == 201
    headers_a = {"Authorization": f"Bearer {reg_a.json()['access_token']}"}

    # User B
    email_b = f"tenant_b_{uuid.uuid4().hex[:8]}@spendwise.app"
    reg_b = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email_b, "password": "Password123!", "name": "User B"},
    )
    assert reg_b.status_code == 201
    headers_b = {"Authorization": f"Bearer {reg_b.json()['access_token']}"}

    cat_b = (await async_client.get("/api/v1/categories", headers=headers_b)).json()[0]["id"]

    # User B logs a ₹50,000 transaction
    now_iso = datetime.datetime.now(datetime.UTC).isoformat()
    await async_client.post(
        "/api/v1/transactions",
        headers=headers_b,
        json={
            "amount_minor": 5000000,
            "category_id": cat_b,
            "payment_method": "upi",
            "occurred_at": now_iso,
        },
    )

    # User A checks analytics -> must be 0!
    summary_a = (await async_client.get("/api/v1/analytics/summary", headers=headers_a)).json()
    assert summary_a["today"]["sum_minor"] == 0
    assert summary_a["month"]["sum_minor"] == 0

    by_cat_a = (await async_client.get("/api/v1/analytics/by-category", headers=headers_a)).json()
    assert by_cat_a["total_minor"] == 0
    assert len(by_cat_a["items"]) == 0
