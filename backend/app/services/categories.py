import datetime
import uuid

from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.category import Category, CategoryRule
from app.models.transaction import Transaction
from app.schemas.category import (
    CategoryChildRead,
    CategoryCreateRequest,
    CategorySuggestionResponse,
    CategoryTreeRead,
    CategoryUpdateRequest,
)


async def get_categories_tree(
    session: AsyncSession,
    user_id: uuid.UUID,
    include_archived: bool = False,
) -> list[CategoryTreeRead]:
    """Returns the complete 2-level category tree with 30-day transaction usage counts."""
    thirty_days_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=30)

    # 1. Rolling 30-day usage counts per category and subcategory
    cat_usage_stmt = (
        select(Transaction.category_id, func.count().label("usage_count"))
        .where(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_at >= thirty_days_ago,
        )
        .group_by(Transaction.category_id)
    )
    cat_res = await session.execute(cat_usage_stmt)
    cat_usage: dict[uuid.UUID, int] = {row[0]: row[1] for row in cat_res.fetchall()}

    subcat_usage_stmt = (
        select(Transaction.subcategory_id, func.count().label("usage_count"))
        .where(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.subcategory_id.is_not(None),
            Transaction.occurred_at >= thirty_days_ago,
        )
        .group_by(Transaction.subcategory_id)
    )
    subcat_res = await session.execute(subcat_usage_stmt)
    subcat_usage: dict[uuid.UUID, int] = {
        row[0]: row[1] for row in subcat_res.fetchall() if row[0] is not None
    }

    # 2. Fetch all categories for user
    query = select(Category).where(Category.user_id == user_id)
    if not include_archived:
        query = query.where(Category.archived_at.is_(None))
    query = query.order_by(Category.sort_order.asc(), Category.name.asc())

    categories_res = await session.execute(query)
    all_categories = categories_res.scalars().all()

    # 3. Organize into parents and children
    parents: list[Category] = []
    children_by_parent: dict[uuid.UUID, list[Category]] = {}

    for cat in all_categories:
        if cat.parent_id is None:
            parents.append(cat)
            if cat.id not in children_by_parent:
                children_by_parent[cat.id] = []
        else:
            children_by_parent.setdefault(cat.parent_id, []).append(cat)

    result: list[CategoryTreeRead] = []
    for p in parents:
        children_list = children_by_parent.get(p.id, [])
        children_reads = [
            CategoryChildRead(
                id=c.id,
                name=c.name,
                icon=c.icon,
                color=c.color,
                sort_order=c.sort_order,
                is_default=c.is_default,
                archived_at=c.archived_at,
                usage_count_30d=subcat_usage.get(c.id, 0),
            )
            for c in children_list
        ]

        result.append(
            CategoryTreeRead(
                id=p.id,
                name=p.name,
                icon=p.icon,
                color=p.color,
                sort_order=p.sort_order,
                is_default=p.is_default,
                archived_at=p.archived_at,
                usage_count_30d=cat_usage.get(p.id, 0),
                children=children_reads,
            )
        )

    return result


async def create_category(
    session: AsyncSession,
    user_id: uuid.UUID,
    payload: CategoryCreateRequest,
) -> Category:
    """Creates a new category or subcategory ensuring depth <= 2 and unique name."""
    clean_name = payload.name.strip()

    # If parent_id specified, validate parent existence and depth limit
    if payload.parent_id is not None:
        parent_stmt = select(Category).where(
            Category.user_id == user_id, Category.id == payload.parent_id
        )
        parent_res = await session.execute(parent_stmt)
        parent = parent_res.scalar_one_or_none()
        if not parent:
            raise NotFoundError("Parent category not found")
        if parent.parent_id is not None:
            raise ValidationError("Categories can only have maximum depth 2 (no sub-subcategories)")

    # Check for name collisions under same parent
    dup_stmt = select(Category).where(
        Category.user_id == user_id,
        func.lower(Category.name) == clean_name.lower(),
        Category.parent_id == payload.parent_id
        if payload.parent_id is not None
        else Category.parent_id.is_(None),
    )
    dup_res = await session.execute(dup_stmt)
    if dup_res.scalar_one_or_none() is not None:
        raise ConflictError(f"A category named '{clean_name}' already exists in this level")

    # Determine sort order
    max_order_stmt = select(func.coalesce(func.max(Category.sort_order), 0)).where(
        Category.user_id == user_id,
        Category.parent_id == payload.parent_id
        if payload.parent_id is not None
        else Category.parent_id.is_(None),
    )
    max_order_res = await session.execute(max_order_stmt)
    next_order = int(max_order_res.scalar_one()) + 1

    category = Category(
        user_id=user_id,
        parent_id=payload.parent_id,
        name=clean_name,
        icon=payload.icon.strip(),
        color=payload.color.strip(),
        sort_order=next_order,
        is_default=False,
    )
    session.add(category)
    await session.commit()
    await session.refresh(category)
    return category


async def update_category(
    session: AsyncSession,
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    payload: CategoryUpdateRequest,
) -> Category:
    """Updates category properties or archive status."""
    stmt = select(Category).where(Category.user_id == user_id, Category.id == category_id)
    res = await session.execute(stmt)
    category = res.scalar_one_or_none()
    if not category:
        raise NotFoundError("Category not found")

    if payload.name is not None:
        clean_name = payload.name.strip()
        if clean_name.lower() != category.name.lower():
            dup_stmt = select(Category).where(
                Category.user_id == user_id,
                Category.id != category.id,
                func.lower(Category.name) == clean_name.lower(),
                Category.parent_id == category.parent_id
                if category.parent_id is not None
                else Category.parent_id.is_(None),
            )
            dup_res = await session.execute(dup_stmt)
            if dup_res.scalar_one_or_none() is not None:
                raise ConflictError(f"A category named '{clean_name}' already exists in this level")
        category.name = clean_name

    if payload.icon is not None:
        category.icon = payload.icon.strip()
    if payload.color is not None:
        category.color = payload.color.strip()
    if payload.sort_order is not None:
        category.sort_order = payload.sort_order
    if payload.archived is not None:
        category.archived_at = datetime.datetime.now(datetime.UTC) if payload.archived else None

    await session.commit()
    await session.refresh(category)
    return category


async def delete_category(
    session: AsyncSession,
    user_id: uuid.UUID,
    category_id: uuid.UUID,
    reassign_to: uuid.UUID | None = None,
) -> None:
    """Deletes category, preventing deletion of default categories and handling transaction reassignment."""
    stmt = select(Category).where(Category.user_id == user_id, Category.id == category_id)
    res = await session.execute(stmt)
    category = res.scalar_one_or_none()
    if not category:
        raise NotFoundError("Category not found")

    if category.is_default:
        raise ValidationError(
            "Default seeded categories cannot be deleted; consider archiving instead"
        )

    # Check referencing transactions
    count_stmt = (
        select(func.count())
        .select_from(Transaction)
        .where(
            Transaction.user_id == user_id,
            (Transaction.category_id == category_id) | (Transaction.subcategory_id == category_id),
        )
    )
    count_res = await session.execute(count_stmt)
    tx_count = int(count_res.scalar_one())

    if tx_count > 0:
        if reassign_to is None:
            raise ConflictError(
                f"Category is used by {tx_count} transaction(s). Specify reassign_to parameter to proceed with deletion."
            )

        # Validate reassign target
        reassign_stmt = select(Category).where(
            Category.user_id == user_id, Category.id == reassign_to
        )
        reassign_res = await session.execute(reassign_stmt)
        target_cat = reassign_res.scalar_one_or_none()
        if not target_cat:
            raise NotFoundError("Reassign target category not found")

        # Reassign transactions
        if category.parent_id is None:
            # Reassign parent category
            reassign_sql = (
                update(Transaction)
                .where(Transaction.user_id == user_id, Transaction.category_id == category_id)
                .values(category_id=target_cat.id, subcategory_id=None)
            )
            await session.execute(reassign_sql)
        else:
            # Reassign subcategory
            reassign_sql = (
                update(Transaction)
                .where(Transaction.user_id == user_id, Transaction.subcategory_id == category_id)
                .values(subcategory_id=target_cat.id)
            )
            await session.execute(reassign_sql)

    await session.delete(category)
    await session.commit()


async def suggest_category(
    session: AsyncSession,
    user_id: uuid.UUID,
    merchant: str,
) -> CategorySuggestionResponse:
    """Auto-suggests category by matching rules first, then transaction history."""
    clean_merchant = merchant.strip().lower()
    if not clean_merchant:
        return CategorySuggestionResponse()

    # 1. Match category rules
    rules_stmt = (
        select(CategoryRule)
        .where(CategoryRule.user_id == user_id)
        .order_by(CategoryRule.priority.desc())
    )
    rules_res = await session.execute(rules_stmt)
    rules = rules_res.scalars().all()

    for rule in rules:
        pattern = rule.pattern.strip().lower()
        if pattern and pattern in clean_merchant:
            return CategorySuggestionResponse(
                category_id=rule.category_id,
                subcategory_id=rule.subcategory_id,
                confidence="rule",
            )

    # 2. Match transaction history for this merchant
    history_stmt = (
        select(Transaction.category_id, Transaction.subcategory_id, func.count().label("cnt"))
        .where(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            func.lower(Transaction.merchant) == clean_merchant,
        )
        .group_by(Transaction.category_id, Transaction.subcategory_id)
        .order_by(desc("cnt"))
        .limit(1)
    )
    hist_res = await session.execute(history_stmt)
    hist_row = hist_res.first()

    if hist_row:
        return CategorySuggestionResponse(
            category_id=hist_row[0],
            subcategory_id=hist_row[1],
            confidence="history",
        )

    return CategorySuggestionResponse()
