import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category, CategoryRule
from app.models.user import User
from app.services.seed import seed_user_defaults


async def test_seed_user_defaults(db_session: AsyncSession) -> None:
    # Create test user
    user = User(
        email=f"seed_test_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="test_hash",
        name="Seed Tester",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    await seed_user_defaults(db_session, user.id)
    await db_session.commit()

    # Verify parent categories (10 expected)
    parents_stmt = select(Category).where(Category.user_id == user.id, Category.parent_id.is_(None))
    parents_res = await db_session.execute(parents_stmt)
    parents = parents_res.scalars().all()
    assert len(parents) == 10

    # Verify subcategories (24 expected per DATABASE.md table)
    subs_stmt = select(Category).where(Category.user_id == user.id, Category.parent_id.is_not(None))
    subs_res = await db_session.execute(subs_stmt)
    subs = subs_res.scalars().all()
    assert len(subs) == 24

    # Verify category rules (25 expected)
    rules_stmt = select(CategoryRule).where(CategoryRule.user_id == user.id)
    rules_res = await db_session.execute(rules_stmt)
    rules = rules_res.scalars().all()
    assert len(rules) == 25

    # Clean up test user
    await db_session.delete(user)
    await db_session.commit()


async def test_seed_demo_data_flow(db_session: AsyncSession) -> None:
    from app.core.security import verify_password
    from app.models.budget import Budget
    from app.models.recurring import RecurringRule
    from app.models.transaction import Transaction
    from app.seed.demo_data import seed_demo_data

    await seed_demo_data(target_days=7, session=db_session)

    user_stmt = select(User).where(User.email == "demo@spendwise.app")
    user = (await db_session.execute(user_stmt)).scalar_one()
    assert user is not None
    assert verify_password("demo1234", user.password_hash)

    # Check transactions
    txs = (
        await db_session.execute(select(Transaction).where(Transaction.user_id == user.id))
    ).scalars().all()
    assert len(txs) > 0
    for tx in txs:
        assert isinstance(tx.amount_minor, int)
        assert tx.amount_minor > 0

    # Check budgets
    budgets = (
        await db_session.execute(select(Budget).where(Budget.user_id == user.id))
    ).scalars().all()
    assert len(budgets) >= 1
    overall_budget = next((b for b in budgets if b.category_id is None), None)
    assert overall_budget is not None
    assert overall_budget.amount_minor == 2000000

    # Check recurring rules
    recurring = (
        await db_session.execute(select(RecurringRule).where(RecurringRule.user_id == user.id))
    ).scalars().all()
    assert len(recurring) >= 2
