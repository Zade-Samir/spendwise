import datetime
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import RecurFreq
from app.services.recurring import compute_next_due_date


async def create_user_and_categories(client: AsyncClient, email: str) -> tuple[str, str, str]:
    """Registers user and returns (token, user_id, first_category_id)."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Recurring User"},
    )
    assert reg.status_code == 201
    data = reg.json()
    token = data["access_token"]
    user_id = data["user"]["id"]

    cats = await client.get("/api/v1/categories", headers={"Authorization": f"Bearer {token}"})
    cat_id = cats.json()[0]["id"]
    return token, user_id, cat_id


def test_calendar_day_clamping_math() -> None:
    """Verifies strict month-end calendar day clamping math per spec §4.1."""
    # 1. 31st of Jan -> Feb non-leap year (e.g. 2027)
    d_jan = datetime.date(2027, 1, 31)
    d_feb = compute_next_due_date(RecurFreq.MONTHLY, 1, d_jan, day_of_month=31)
    assert d_feb == datetime.date(2027, 2, 28)

    # 2. 31st of Jan -> Feb leap year (e.g. 2028)
    d_jan_leap = datetime.date(2028, 1, 31)
    d_feb_leap = compute_next_due_date(RecurFreq.MONTHLY, 1, d_jan_leap, day_of_month=31)
    assert d_feb_leap == datetime.date(2028, 2, 29)

    # 3. From Feb -> Mar (restores 31st)
    d_mar = compute_next_due_date(RecurFreq.MONTHLY, 1, d_feb, day_of_month=31)
    assert d_mar == datetime.date(2027, 3, 31)

    # 4. From Mar 31 -> Apr (clamps to 30th)
    d_apr = compute_next_due_date(RecurFreq.MONTHLY, 1, d_mar, day_of_month=31)
    assert d_apr == datetime.date(2027, 4, 30)


@pytest.mark.asyncio
async def test_recurring_crud_and_remind_workflow(async_client: AsyncClient) -> None:
    token, _, cat_id = await create_user_and_categories(
        async_client, f"rec_remind_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    headers = {"Authorization": f"Bearer {token}"}
    today = datetime.datetime.now(datetime.UTC).date()

    # 1. Create rule in remind mode
    create_payload = {
        "name": "Wi-Fi Broadband",
        "amount_minor": 99900,
        "category_id": cat_id,
        "merchant": "Airtel Fiber",
        "payment_method": "upi",
        "frequency": "monthly",
        "interval_count": 1,
        "day_of_month": today.day,
        "start_date": today.isoformat(),
        "mode": "remind",
    }
    create_res = await async_client.post("/api/v1/recurring", headers=headers, json=create_payload)
    assert create_res.status_code == 201, create_res.text
    rule = create_res.json()
    rule_id = rule["id"]
    assert rule["name"] == "Wi-Fi Broadband"
    assert rule["amount_minor"] == 99900

    # 2. Check due rules: should appear on Dashboard due card
    due_res = await async_client.get("/api/v1/recurring/due", headers=headers)
    assert due_res.status_code == 200
    due_items = due_res.json()
    assert len(due_items) == 1
    assert due_items[0]["id"] == rule_id

    # 3. Confirm payment
    confirm_res = await async_client.post(
        f"/api/v1/recurring/{rule_id}/confirm",
        headers=headers,
        json={"amount_minor": 99900},
    )
    assert confirm_res.status_code == 201, confirm_res.text
    confirmed_tx = confirm_res.json()
    assert confirmed_tx["amount_minor"] == 99900
    assert confirmed_tx["source"] == "recurring"

    # 4. Due rules should now be empty (next_due_date advanced to next month)
    due_res_after = await async_client.get("/api/v1/recurring/due", headers=headers)
    assert len(due_res_after.json()) == 0

    # 5. Skip cycle test: set next_due_date back to today, then call skip
    patch_res = await async_client.patch(
        f"/api/v1/recurring/{rule_id}",
        headers=headers,
        json={"start_date": today.isoformat()},
    )
    assert patch_res.status_code == 200

    skip_res = await async_client.post(f"/api/v1/recurring/{rule_id}/skip", headers=headers)
    assert skip_res.status_code == 200
    skipped_rule = skip_res.json()
    assert skipped_rule["next_due_date"] > today.isoformat()


@pytest.mark.asyncio
async def test_recurring_auto_create_catch_up_idempotency(
    async_client: AsyncClient, db_session: AsyncSession
) -> None:
    token, _, cat_id = await create_user_and_categories(
        async_client, f"rec_auto_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    headers = {"Authorization": f"Bearer {token}"}
    today = datetime.datetime.now(datetime.UTC).date()
    past_date = today - datetime.timedelta(days=5)

    # Create daily rule in auto_create mode with start_date in the past
    create_payload = {
        "name": "Daily Newspaper",
        "amount_minor": 1500,
        "category_id": cat_id,
        "payment_method": "cash",
        "frequency": "daily",
        "interval_count": 1,
        "start_date": past_date.isoformat(),
        "mode": "auto_create",
    }
    create_res = await async_client.post("/api/v1/recurring", headers=headers, json=create_payload)
    assert create_res.status_code == 201

    # Call background processor manually
    from app.services.recurring import RecurringService

    created_1 = await RecurringService.process_auto_create_rules(db_session, today_date=today)
    assert created_1 > 0

    # Running a second time on the same day must create 0 duplicates!
    created_2 = await RecurringService.process_auto_create_rules(db_session, today_date=today)
    assert created_2 == 0


@pytest.mark.asyncio
async def test_multi_tenant_recurring_isolation(async_client: AsyncClient) -> None:
    token_a, _, cat_a = await create_user_and_categories(
        async_client, f"rec_user_a_{uuid.uuid4().hex[:8]}@spendwise.app"
    )
    token_b, _, _ = await create_user_and_categories(
        async_client, f"rec_user_b_{uuid.uuid4().hex[:8]}@spendwise.app"
    )

    today = datetime.datetime.now(datetime.UTC).date()

    # User A creates rule
    res_a = await async_client.post(
        "/api/v1/recurring",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "name": "Secret A Rule",
            "amount_minor": 50000,
            "category_id": cat_a,
            "frequency": "monthly",
            "start_date": today.isoformat(),
            "mode": "remind",
        },
    )
    rule_a_id = res_a.json()["id"]

    # User B cannot see User A's rule
    b_rules = await async_client.get(
        "/api/v1/recurring", headers={"Authorization": f"Bearer {token_b}"}
    )
    assert len(b_rules.json()) == 0

    # User B cannot confirm User A's rule
    b_confirm = await async_client.post(
        f"/api/v1/recurring/{rule_a_id}/confirm",
        headers={"Authorization": f"Bearer {token_b}"},
        json={},
    )
    assert b_confirm.status_code == 404

    # User B cannot skip User A's rule
    b_skip = await async_client.post(
        f"/api/v1/recurring/{rule_a_id}/skip",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert b_skip.status_code == 404

    # User B cannot delete User A's rule
    b_del = await async_client.delete(
        f"/api/v1/recurring/{rule_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert b_del.status_code == 404
