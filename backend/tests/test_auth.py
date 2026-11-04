import uuid

from httpx import AsyncClient


async def test_register_validation_and_success(async_client: AsyncClient) -> None:
    # 1. Reject weak/short password (<8 characters)
    res_short = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "weak@example.com", "password": "short", "name": "Weak User"},
    )
    assert res_short.status_code == 422

    # 2. Reject common password
    res_common = await async_client.post(
        "/api/v1/auth/register",
        json={"email": "common@example.com", "password": "password123", "name": "Common User"},
    )
    assert res_common.status_code == 422
    assert "common" in res_common.json()["error"]["message"].lower()

    # 3. Successful registration
    unique_email = f"priya_{uuid.uuid4().hex[:8]}@example.com"
    res_reg = await async_client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": "SecretP@ssword2026!", "name": "Priya Sharma"},
    )
    assert res_reg.status_code == 201
    data = res_reg.json()
    assert "user" in data
    assert data["user"]["email"] == unique_email
    assert data["user"]["name"] == "Priya Sharma"
    assert data["user"]["currency"] == "INR"
    assert data["user"]["timezone"] == "Asia/Kolkata"
    assert "access_token" in data
    assert "refresh_token" in data

    # 4. Duplicate email registration conflict
    res_dup = await async_client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": "SecretP@ssword2026!", "name": "Priya Sharma"},
    )
    assert res_dup.status_code == 409


async def test_login_and_token_rotation_and_reuse_defense(async_client: AsyncClient) -> None:
    unique_email = f"auth_flow_{uuid.uuid4().hex[:8]}@example.com"
    password = "CorrectHorseBattery2026!"

    # Register user
    reg_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": password, "name": "Flow Tester"},
    )
    assert reg_res.status_code == 201
    assert isinstance(reg_res.json()["refresh_token"], str)

    # Login with wrong password -> 401
    bad_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401

    # Login with correct password -> 200
    good_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": password},
    )
    assert good_login.status_code == 200
    login_data = good_login.json()
    active_refresh_token = login_data["refresh_token"]

    # Rotate refresh token -> 200
    refresh_res = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": active_refresh_token},
    )
    assert refresh_res.status_code == 200
    new_token_data = refresh_res.json()
    assert "access_token" in new_token_data
    assert "refresh_token" in new_token_data
    rotated_refresh_token = new_token_data["refresh_token"]
    assert rotated_refresh_token != active_refresh_token

    # Token Reuse Attack: Presenting the old active_refresh_token that was just rotated
    reuse_res = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": active_refresh_token},
    )
    assert reuse_res.status_code == 401
    assert "reuse" in reuse_res.json()["error"]["message"].lower()

    # Now rotated_refresh_token should ALSO be revoked due to automatic breach neutralization
    blocked_res = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": rotated_refresh_token},
    )
    assert blocked_res.status_code == 401


async def test_user_profile_and_lifecycle(async_client: AsyncClient) -> None:
    unique_email = f"lifecycle_{uuid.uuid4().hex[:8]}@example.com"
    password = "InitialPassword123!"

    reg_res = await async_client.post(
        "/api/v1/auth/register",
        json={"email": unique_email, "password": password, "name": "Lifecycle User"},
    )
    assert reg_res.status_code == 201
    access_token = reg_res.json()["access_token"]
    auth_header = {"Authorization": f"Bearer {access_token}"}

    # 1. GET /users/me
    me_res = await async_client.get("/api/v1/users/me", headers=auth_header)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == unique_email

    # 2. PATCH /users/me
    patch_res = await async_client.patch(
        "/api/v1/users/me",
        headers=auth_header,
        json={"month_start_day": 25, "theme": "dark", "name": "Updated Name"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["month_start_day"] == 25
    assert patch_res.json()["theme"] == "dark"
    assert patch_res.json()["name"] == "Updated Name"

    # 3. POST /users/me/change-password
    new_password = "BrandNewSecurePassword456!"
    pw_res = await async_client.post(
        "/api/v1/users/me/change-password",
        headers=auth_header,
        json={"current_password": password, "new_password": new_password},
    )
    assert pw_res.status_code == 204

    # Verify old password no longer works for login
    old_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": password},
    )
    assert old_login.status_code == 401

    # Verify new password logs in
    new_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": new_password},
    )
    assert new_login.status_code == 200
    new_access_token = new_login.json()["access_token"]

    # 4. DELETE /users/me
    del_res = await async_client.request(
        "DELETE",
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {new_access_token}"},
        json={"password": new_password},
    )
    assert del_res.status_code == 204

    # Verify user cannot log in anymore
    deleted_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": new_password},
    )
    assert deleted_login.status_code == 401
