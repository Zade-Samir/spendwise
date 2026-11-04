import asyncio
import datetime
import random
import sys
import time
import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.core.security import hash_password
from app.models.budget import Budget
from app.models.enums import BudgetPeriod, PaymentMethod, RecurFreq, RecurMode, TxnSource
from app.models.recurring import RecurringRule
from app.models.transaction import Transaction
from app.models.user import User
from app.services.analytics import (
    get_analytics_by_category,
    get_analytics_summary,
    get_analytics_trend,
)
from app.services.auth import register_user
from app.services.categories import get_categories_tree

INDIAN_EXPENSES = [
    # Auto & Cabs (₹60 - ₹250)
    ("Auto Fare", "Transportation", 6000, 25000, PaymentMethod.UPI),
    ("Uber Go", "Transportation", 12000, 28000, PaymentMethod.UPI),
    ("Ola Auto", "Transportation", 7500, 18000, PaymentMethod.UPI),
    # Tea & Snacks (₹20 - ₹60)
    ("Tapri Chai", "Food & Dining", 2000, 6000, PaymentMethod.CASH),
    ("Chai Point", "Food & Dining", 4000, 9000, PaymentMethod.UPI),
    # Lunch & Dining (₹120 - ₹300)
    ("Swiggy Lunch", "Food & Dining", 14000, 32000, PaymentMethod.UPI),
    ("Zomato Delivery", "Food & Dining", 18000, 35000, PaymentMethod.UPI),
    ("Office Cafeteria", "Food & Dining", 10000, 18000, PaymentMethod.UPI),
    # Groceries (₹200 - ₹2500)
    ("Blinkit", "Groceries", 25000, 85000, PaymentMethod.UPI),
    ("Zepto Quick", "Groceries", 18000, 60000, PaymentMethod.UPI),
    ("DMart Supermarket", "Groceries", 120000, 250000, PaymentMethod.CARD),
    ("Local Kirana", "Groceries", 15000, 45000, PaymentMethod.CASH),
    # Shopping (large items)
    ("Amazon India", "Shopping", 99900, 350000, PaymentMethod.CARD),
    ("Myntra Fashion", "Shopping", 149900, 280000, PaymentMethod.CARD),
]


async def _execute_seed(
    session: AsyncSession, target_days: int = 90, benchmark: bool = False
) -> None:
    # 1. Get or create demo user
    stmt = select(User).where(User.email == "demo@spendwise.app")
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        print("Creating demo account demo@spendwise.app...")
        user, _, _ = await register_user(
            session=session,
            email="demo@spendwise.app",
            password="demo1234",
            name="Demo User",
        )
        print(f"Created demo account with ID: {user.id}")
    else:
        print(f"Updating demo user credentials for ID: {user.id}...")
        user.password_hash = hash_password("demo1234")
        await session.commit()

    # 2. Reset existing demo transactions, budgets, and recurring rules for idempotent rerun
    print("Cleaning up previous demo transactions, budgets, and recurring rules...")
    await session.execute(delete(Transaction).where(Transaction.user_id == user.id))
    await session.execute(delete(Budget).where(Budget.user_id == user.id))
    await session.execute(delete(RecurringRule).where(RecurringRule.user_id == user.id))
    await session.commit()

    # 3. Retrieve user categories
    categories = await get_categories_tree(session, user.id)
    cat_map = {c.name: c.id for c in categories}
    fallback_cat_id = categories[0].id if categories else uuid.uuid4()

    # 4. Generate ~3 months (90 days) of transactions
    now = datetime.datetime.now(datetime.UTC)
    transactions_to_insert: list[Transaction] = []

    print(f"Generating realistic Indian transactions for the past {target_days} days...")
    for day_offset in range(target_days, -1, -1):
        day_date = now - datetime.timedelta(days=day_offset)
        weekday = day_date.weekday()  # 0=Mon, 6=Sun

        # Monthly rent on 1st of month
        if day_date.day == 1:
            rent_cat_id = cat_map.get("Housing", cat_map.get("Bills & Utilities", fallback_cat_id))
            transactions_to_insert.append(
                Transaction(
                    user_id=user.id,
                    amount_minor=2200000,  # ₹22,000
                    category_id=rent_cat_id,
                    merchant="Landlord",
                    description="Monthly House Rent",
                    payment_method=PaymentMethod.BANK_TRANSFER,
                    occurred_at=day_date.replace(hour=10, minute=0, second=0),
                    source=TxnSource.MANUAL,
                    client_id=str(uuid.uuid4()),
                )
            )

        # Monthly broadband on 5th
        if day_date.day == 5:
            util_cat_id = cat_map.get("Bills & Utilities", fallback_cat_id)
            transactions_to_insert.append(
                Transaction(
                    user_id=user.id,
                    amount_minor=99900,  # ₹999
                    category_id=util_cat_id,
                    merchant="Airtel Broadband",
                    description="Monthly Internet Bill",
                    payment_method=PaymentMethod.UPI,
                    occurred_at=day_date.replace(hour=11, minute=30, second=0),
                    source=TxnSource.MANUAL,
                    client_id=str(uuid.uuid4()),
                )
            )

        # Monthly electricity on 10th
        if day_date.day == 10:
            util_cat_id = cat_map.get("Bills & Utilities", fallback_cat_id)
            transactions_to_insert.append(
                Transaction(
                    user_id=user.id,
                    amount_minor=145000,  # ₹1,450
                    category_id=util_cat_id,
                    merchant="BESCOM Electricity",
                    description="Electricity Bill",
                    payment_method=PaymentMethod.UPI,
                    occurred_at=day_date.replace(hour=14, minute=15, second=0),
                    source=TxnSource.MANUAL,
                    client_id=str(uuid.uuid4()),
                )
            )

        # Weekday: 3-5 txns; Weekend: 1-3 txns; ~10% days: 0 txns
        if random.random() < 0.08:
            continue  # zero-spend day

        num_txns = random.randint(3, 5) if weekday < 5 else random.randint(1, 3)
        for _ in range(num_txns):
            merchant, cat_name, min_paise, max_paise, default_pm = random.choice(
                INDIAN_EXPENSES
            )
            cat_id = cat_map.get(cat_name, fallback_cat_id)
            amount_minor = random.randint(min_paise, max_paise)

            hour = random.randint(8, 22)
            minute = random.randint(0, 59)
            tx_time = day_date.replace(hour=hour, minute=minute, second=random.randint(0, 59))

            transactions_to_insert.append(
                Transaction(
                    user_id=user.id,
                    amount_minor=amount_minor,
                    category_id=cat_id,
                    merchant=merchant,
                    description=f"{merchant} payment",
                    payment_method=default_pm,
                    occurred_at=tx_time,
                    source=TxnSource.MANUAL,
                    client_id=str(uuid.uuid4()),
                )
            )

    # Batch insert transactions
    chunk_size = 500
    for i in range(0, len(transactions_to_insert), chunk_size):
        chunk = transactions_to_insert[i : i + chunk_size]
        session.add_all(chunk)
        await session.commit()

    print(f"Successfully inserted {len(transactions_to_insert)} realistic INR transactions!")

    # 5. Create default overall and category budgets
    print("Seeding monthly budgets (Overall ₹20,000 + Category budgets)...")
    budgets_to_add = [
        # Overall monthly budget: ₹20,000
        Budget(
            user_id=user.id,
            category_id=None,
            period=BudgetPeriod.MONTHLY,
            amount_minor=2000000,
            alert_threshold_pct=80,
            active=True,
        ),
    ]
    if "Food & Dining" in cat_map:
        budgets_to_add.append(
            Budget(
                user_id=user.id,
                category_id=cat_map["Food & Dining"],
                period=BudgetPeriod.MONTHLY,
                amount_minor=800000,  # ₹8,000
                alert_threshold_pct=80,
                active=True,
            )
        )
    if "Transportation" in cat_map:
        budgets_to_add.append(
            Budget(
                user_id=user.id,
                category_id=cat_map["Transportation"],
                period=BudgetPeriod.MONTHLY,
                amount_minor=300000,  # ₹3,000
                alert_threshold_pct=80,
                active=True,
            )
        )
    if "Groceries" in cat_map:
        budgets_to_add.append(
            Budget(
                user_id=user.id,
                category_id=cat_map["Groceries"],
                period=BudgetPeriod.MONTHLY,
                amount_minor=500000,  # ₹5,000
                alert_threshold_pct=80,
                active=True,
            )
        )
    session.add_all(budgets_to_add)
    await session.commit()

    # 6. Create realistic recurring rules
    print("Seeding recurring expenses (Rent, Broadband, Netflix)...")
    today = datetime.date.today()
    first_next_month = (today.replace(day=1) + datetime.timedelta(days=32)).replace(day=1)

    recurring_rules = [
        RecurringRule(
            user_id=user.id,
            name="House Rent",
            amount_minor=2200000,  # ₹22,000
            category_id=cat_map.get("Housing", cat_map.get("Bills & Utilities", fallback_cat_id)),
            merchant="Landlord",
            payment_method=PaymentMethod.BANK_TRANSFER,
            frequency=RecurFreq.MONTHLY,
            interval_count=1,
            day_of_month=1,
            start_date=today - datetime.timedelta(days=90),
            next_due_date=first_next_month,
            mode=RecurMode.REMIND,
            active=True,
        ),
        RecurringRule(
            user_id=user.id,
            name="Airtel Broadband",
            amount_minor=99900,  # ₹999
            category_id=cat_map.get("Bills & Utilities", fallback_cat_id),
            merchant="Airtel",
            payment_method=PaymentMethod.UPI,
            frequency=RecurFreq.MONTHLY,
            interval_count=1,
            day_of_month=5,
            start_date=today - datetime.timedelta(days=90),
            next_due_date=first_next_month.replace(day=5),
            mode=RecurMode.REMIND,
            active=True,
        ),
    ]
    session.add_all(recurring_rules)
    await session.commit()

    print("Demo seed completed successfully!")
    print("Credentials: demo@spendwise.app / demo1234")

    if benchmark:
        print("\n--- Running Latency Benchmarks on Analytics Engine ---")
        t0 = time.perf_counter()
        await get_analytics_summary(session, user)
        t_summary = (time.perf_counter() - t0) * 1000

        t0 = time.perf_counter()
        by_cat = await get_analytics_by_category(session, user)
        t_by_cat = (time.perf_counter() - t0) * 1000

        t0 = time.perf_counter()
        trend = await get_analytics_trend(session, user)
        t_trend = (time.perf_counter() - t0) * 1000

        print(f"GET /analytics/summary: {t_summary:.2f} ms")
        print(
            f"GET /analytics/by-category: {t_by_cat:.2f} ms (Total: ₹{by_cat.total_minor / 100:,.2f})"
        )
        print(f"GET /analytics/trend: {t_trend:.2f} ms ({len(trend.points)} points)")

        assert t_summary < 300, f"Summary latency {t_summary}ms exceeded 300ms SLA"
        assert t_by_cat < 300, f"By-Category latency {t_by_cat}ms exceeded 300ms SLA"
        assert t_trend < 300, f"Trend latency {t_trend}ms exceeded 300ms SLA"
        print("✓ All latency SLAs (< 300ms) passed!")


async def seed_demo_data(
    target_days: int = 90, benchmark: bool = False, session: AsyncSession | None = None
) -> None:
    """Generates ~3 months of realistic Indian-context INR expenses for demo@spendwise.app."""
    if session is not None:
        await _execute_seed(session, target_days=target_days, benchmark=benchmark)
    else:
        async with AsyncSessionLocal() as sess:
            await _execute_seed(sess, target_days=target_days, benchmark=benchmark)


if __name__ == "__main__":
    days = 90
    bench = False
    if "--bench" in sys.argv:
        days = 90
        bench = True
    elif len(sys.argv) > 1 and sys.argv[1].isdigit():
        days = int(sys.argv[1])

    asyncio.run(seed_demo_data(target_days=days, benchmark=bench))
