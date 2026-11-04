import uuid

from httpx import AsyncClient


async def test_category_endpoints_and_lifecycle(async_client: AsyncClient) -> None:
    # 1. Register a test user
    email = f"cat_test_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "SecurePassword123!", "name": "Category Tester"},
    )
    assert reg_res.status_code == 201
    auth_header = {"Authorization": f"Bearer {reg_res.json()['access_token']}"}

    # 2. GET /categories returns seeded tree
    tree_res = await async_client.get("/api/v1/categories", headers=auth_header)
    assert tree_res.status_code == 200
    tree = tree_res.json()
    assert len(tree) == 10  # 10 default parents
    food_cat = next(c for c in tree if c["name"] == "Food & Dining")
    assert food_cat["is_default"] is True
    assert len(food_cat["children"]) == 3  # Restaurant, Cafe, Delivery

    # 3. GET /categories/suggest?merchant=uber matches Transportation rule
    sug_res = await async_client.get(
        "/api/v1/categories/suggest?merchant=uber", headers=auth_header
    )
    assert sug_res.status_code == 200
    sug_data = sug_res.json()
    assert sug_data["confidence"] == "rule"
    assert sug_data["category_id"] is not None

    # 4. POST /categories creates custom top-level category
    create_res = await async_client.post(
        "/api/v1/categories",
        headers=auth_header,
        json={"name": "Fitness & Sports", "icon": "dumbbell", "color": "#10B981"},
    )
    assert create_res.status_code == 201
    custom_cat = create_res.json()
    assert custom_cat["name"] == "Fitness & Sports"

    # 5. POST /categories creates custom subcategory
    sub_res = await async_client.post(
        "/api/v1/categories",
        headers=auth_header,
        json={
            "name": "Gym Membership",
            "icon": "dumbbell",
            "color": "#10B981",
            "parent_id": custom_cat["id"],
        },
    )
    assert sub_res.status_code == 201
    custom_sub = sub_res.json()

    # 6. Reject depth > 2 (trying to create subcategory under a subcategory)
    deep_res = await async_client.post(
        "/api/v1/categories",
        headers=auth_header,
        json={
            "name": "Personal Trainer",
            "icon": "dumbbell",
            "color": "#10B981",
            "parent_id": custom_sub["id"],
        },
    )
    assert deep_res.status_code == 422
    assert "depth 2" in deep_res.json()["error"]["message"]

    # 7. Reject duplicate name under same parent
    dup_res = await async_client.post(
        "/api/v1/categories",
        headers=auth_header,
        json={"name": "Fitness & Sports", "icon": "dumbbell", "color": "#10B981"},
    )
    assert dup_res.status_code == 409

    # 8. PATCH /categories/{id} updates category
    patch_res = await async_client.patch(
        f"/api/v1/categories/{custom_cat['id']}",
        headers=auth_header,
        json={"name": "Gym & Wellness", "color": "#059669"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "Gym & Wellness"

    # 9. Reject deleting default category
    del_default_res = await async_client.delete(
        f"/api/v1/categories/{food_cat['id']}", headers=auth_header
    )
    assert del_default_res.status_code == 422
    assert (
        "default seeded categories cannot be deleted"
        in del_default_res.json()["error"]["message"].lower()
    )

    # 10. Delete custom category
    del_res = await async_client.delete(
        f"/api/v1/categories/{custom_cat['id']}", headers=auth_header
    )
    assert del_res.status_code == 204
