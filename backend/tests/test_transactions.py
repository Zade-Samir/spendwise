import datetime
import uuid

from httpx import AsyncClient


async def test_transaction_creation_and_idempotency(async_client: AsyncClient) -> None:
    # 1. Register user
    email = f"tx_user_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePassword123!", "name": "Tx Tester"},
    )
    assert reg_res.status_code == 201
    auth_header = {"Authorization": f"Bearer {reg_res.json()['access_token']}"}

    # 2. Get Food & Dining category ID
    cat_res = await async_client.get("/api/v1/categories", headers=auth_header)
    food_cat = next(c for c in cat_res.json() if c["name"] == "Food & Dining")
    restaurant_subcat = food_cat["children"][0]

    client_uuid = str(uuid.uuid4())

    # 3. Create transaction
    create_payload = {
        "amount_minor": 15000,  # ₹150.00
        "category_id": food_cat["id"],
        "subcategory_id": restaurant_subcat["id"],
        "merchant": "Saravana Bhavan",
        "description": "Lunch with team",
        "payment_method": "upi",
        "client_id": client_uuid,
    }

    create_res = await async_client.post(
        "/api/v1/transactions", headers=auth_header, json=create_payload
    )
    assert create_res.status_code == 201
    tx_data = create_res.json()
    assert tx_data["amount_minor"] == 15000
    assert tx_data["category"]["name"] == "Food & Dining"
    assert tx_data["subcategory"]["name"] == restaurant_subcat["name"]
    assert tx_data["client_id"] == client_uuid

    # 4. Idempotent replay with identical client_id returns 200 OK with same ID
    replay_res = await async_client.post(
        "/api/v1/transactions", headers=auth_header, json=create_payload
    )
    assert replay_res.status_code == 200
    assert replay_res.json()["id"] == tx_data["id"]

    # Verify transaction count is still 1
    list_res = await async_client.get("/api/v1/transactions", headers=auth_header)
    assert list_res.status_code == 200
    assert list_res.json()["totals"]["count"] == 1


async def test_transaction_validation_rules(async_client: AsyncClient) -> None:
    email = f"val_user_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePassword123!", "name": "Val Tester"},
    )
    auth_header = {"Authorization": f"Bearer {reg_res.json()['access_token']}"}

    cat_res = await async_client.get("/api/v1/categories", headers=auth_header)
    categories = cat_res.json()
    food_cat = categories[0]
    transport_cat = categories[1]
    transport_subcat = transport_cat["children"][0]

    # Amount <= 0 rejected
    res_zero = await async_client.post(
        "/api/v1/transactions",
        headers=auth_header,
        json={"amount_minor": 0, "category_id": food_cat["id"]},
    )
    assert res_zero.status_code == 422

    # Amount > 10 crore rejected
    res_huge = await async_client.post(
        "/api/v1/transactions",
        headers=auth_header,
        json={"amount_minor": 1_000_000_001, "category_id": food_cat["id"]},
    )
    assert res_huge.status_code == 422

    # Future date (> now + 5 min) rejected
    future_time = (datetime.datetime.now(datetime.UTC) + datetime.timedelta(minutes=10)).isoformat()
    res_future = await async_client.post(
        "/api/v1/transactions",
        headers=auth_header,
        json={"amount_minor": 1000, "category_id": food_cat["id"], "occurred_at": future_time},
    )
    assert res_future.status_code == 422

    # Subcategory mismatch rejected (Transport subcat with Food parent)
    res_mismatch = await async_client.post(
        "/api/v1/transactions",
        headers=auth_header,
        json={
            "amount_minor": 1000,
            "category_id": food_cat["id"],
            "subcategory_id": transport_subcat["id"],
        },
    )
    assert res_mismatch.status_code == 422


async def test_transaction_search_filtering_and_totals(async_client: AsyncClient) -> None:
    email = f"search_user_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePassword123!", "name": "Search Tester"},
    )
    auth_header = {"Authorization": f"Bearer {reg_res.json()['access_token']}"}

    cat_res = await async_client.get("/api/v1/categories", headers=auth_header)
    food_cat = next(c for c in cat_res.json() if c["name"] == "Food & Dining")
    transport_cat = next(c for c in cat_res.json() if c["name"] == "Transportation")

    # Add 3 transactions
    await async_client.post(
        "/api/v1/transactions",
        headers=auth_header,
        json={
            "amount_minor": 15000,
            "category_id": food_cat["id"],
            "merchant": "Saravana Bhavan",
            "description": "Lunch dosa",
            "payment_method": "upi",
        },
    )
    await async_client.post(
        "/api/v1/transactions",
        headers=auth_header,
        json={
            "amount_minor": 45000,
            "category_id": transport_cat["id"],
            "merchant": "Uber India",
            "description": "Airport ride",
            "payment_method": "card",
        },
    )
    await async_client.post(
        "/api/v1/transactions",
        headers=auth_header,
        json={
            "amount_minor": 120000,
            "category_id": food_cat["id"],
            "merchant": "BigBasket",
            "description": "Vegetables",
            "payment_method": "upi",
        },
    )

    # 1. Total count and sum reconciliation
    list_all = await async_client.get("/api/v1/transactions", headers=auth_header)
    assert list_all.status_code == 200
    totals = list_all.json()["totals"]
    assert totals["count"] == 3
    assert totals["sum_minor"] == 15000 + 45000 + 120000

    # 2. Fuzzy search by merchant
    search_sarav = await async_client.get("/api/v1/transactions?q=sarav", headers=auth_header)
    assert search_sarav.status_code == 200
    items_sarav = search_sarav.json()["items"]
    assert len(items_sarav) == 1
    assert items_sarav[0]["merchant"] == "Saravana Bhavan"

    # 3. Filter by payment method
    filter_card = await async_client.get(
        "/api/v1/transactions?payment_method=card", headers=auth_header
    )
    assert filter_card.status_code == 200
    assert len(filter_card.json()["items"]) == 1
    assert filter_card.json()["items"][0]["merchant"] == "Uber India"

    # 4. Filter by amount range
    filter_amt = await async_client.get(
        "/api/v1/transactions?min_amount_minor=20000&max_amount_minor=50000", headers=auth_header
    )
    assert filter_amt.status_code == 200
    assert len(filter_amt.json()["items"]) == 1
    assert filter_amt.json()["items"][0]["amount_minor"] == 45000


async def test_transaction_soft_delete_and_restore(async_client: AsyncClient) -> None:
    email = f"delete_user_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePassword123!", "name": "Delete Tester"},
    )
    auth_header = {"Authorization": f"Bearer {reg_res.json()['access_token']}"}

    cat_res = await async_client.get("/api/v1/categories", headers=auth_header)
    cat_id = cat_res.json()[0]["id"]

    create_res = await async_client.post(
        "/api/v1/transactions",
        headers=auth_header,
        json={"amount_minor": 20000, "category_id": cat_id, "merchant": "Cafe Coffee Day"},
    )
    tx_id = create_res.json()["id"]

    # 1. Soft-delete
    del_res = await async_client.delete(f"/api/v1/transactions/{tx_id}", headers=auth_header)
    assert del_res.status_code == 204

    # 2. Verify excluded from active list
    list_res = await async_client.get("/api/v1/transactions", headers=auth_header)
    assert list_res.json()["totals"]["count"] == 0

    # 3. Restore (Undo action)
    restore_res = await async_client.post(
        f"/api/v1/transactions/{tx_id}/restore", headers=auth_header
    )
    assert restore_res.status_code == 200

    # 4. Verify back in active list
    list_after_restore = await async_client.get("/api/v1/transactions", headers=auth_header)
    assert list_after_restore.json()["totals"]["count"] == 1


async def test_multi_tenant_user_isolation(async_client: AsyncClient) -> None:
    # User A creates transaction
    reg_a = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": f"user_a_{uuid.uuid4().hex[:8]}@example.com",
            "password": "SecurePassword123!",
            "name": "User A",
        },
    )
    auth_a = {"Authorization": f"Bearer {reg_a.json()['access_token']}"}
    cats_a = (await async_client.get("/api/v1/categories", headers=auth_a)).json()
    tx_a = (
        await async_client.post(
            "/api/v1/transactions",
            headers=auth_a,
            json={
                "amount_minor": 50000,
                "category_id": cats_a[0]["id"],
                "merchant": "User A Secret Store",
            },
        )
    ).json()

    # User B tries to read, update, or delete User A's transaction
    reg_b = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": f"user_b_{uuid.uuid4().hex[:8]}@example.com",
            "password": "SecurePassword123!",
            "name": "User B",
        },
    )
    auth_b = {"Authorization": f"Bearer {reg_b.json()['access_token']}"}

    # GET -> 404 Not Found
    get_res = await async_client.get(f"/api/v1/transactions/{tx_a['id']}", headers=auth_b)
    assert get_res.status_code == 404

    # PATCH -> 404 Not Found
    patch_res = await async_client.patch(
        f"/api/v1/transactions/{tx_a['id']}",
        headers=auth_b,
        json={"amount_minor": 100},
    )
    assert patch_res.status_code == 404

    # DELETE -> 404 Not Found
    del_res = await async_client.delete(f"/api/v1/transactions/{tx_a['id']}", headers=auth_b)
    assert del_res.status_code == 404
