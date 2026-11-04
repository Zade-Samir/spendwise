import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category, CategoryRule

DEFAULT_CATEGORIES_DATA = [
    {
        "name": "Food & Dining",
        "icon": "utensils",
        "color": "#F97316",
        "sort_order": 1,
        "subcategories": ["Restaurant", "Cafe", "Delivery"],
    },
    {
        "name": "Transportation",
        "icon": "car",
        "color": "#3B82F6",
        "sort_order": 2,
        "subcategories": ["Auto", "Cab", "Bus", "Train", "Fuel"],
    },
    {
        "name": "Groceries",
        "icon": "shopping-basket",
        "color": "#22C55E",
        "sort_order": 3,
        "subcategories": ["Vegetables", "Household"],
    },
    {
        "name": "Shopping",
        "icon": "shopping-bag",
        "color": "#A855F7",
        "sort_order": 4,
        "subcategories": ["Clothes", "Electronics"],
    },
    {
        "name": "Bills",
        "icon": "receipt",
        "color": "#EAB308",
        "sort_order": 5,
        "subcategories": ["Electricity", "Internet", "Mobile"],
    },
    {
        "name": "Housing",
        "icon": "home",
        "color": "#14B8A6",
        "sort_order": 6,
        "subcategories": ["Rent", "Maintenance"],
    },
    {
        "name": "Entertainment",
        "icon": "film",
        "color": "#EC4899",
        "sort_order": 7,
        "subcategories": ["Movies", "Games"],
    },
    {
        "name": "Healthcare",
        "icon": "heart-pulse",
        "color": "#EF4444",
        "sort_order": 8,
        "subcategories": ["Medicine", "Doctor"],
    },
    {
        "name": "Travel",
        "icon": "plane",
        "color": "#06B6D4",
        "sort_order": 9,
        "subcategories": ["Hotels", "Tickets"],
    },
    {
        "name": "Others",
        "icon": "circle-ellipsis",
        "color": "#64748B",
        "sort_order": 10,
        "subcategories": ["Miscellaneous"],
    },
]

DEFAULT_CATEGORY_RULES_DATA: list[dict[str, str | None]] = [
    {"pattern": "uber", "category": "Transportation", "subcategory": "Cab"},
    {"pattern": "ola", "category": "Transportation", "subcategory": "Cab"},
    {"pattern": "rapido", "category": "Transportation", "subcategory": "Cab"},
    {"pattern": "swiggy", "category": "Food & Dining", "subcategory": "Delivery"},
    {"pattern": "zomato", "category": "Food & Dining", "subcategory": "Delivery"},
    {"pattern": "bigbasket", "category": "Groceries", "subcategory": None},
    {"pattern": "blinkit", "category": "Groceries", "subcategory": None},
    {"pattern": "zepto", "category": "Groceries", "subcategory": None},
    {"pattern": "dmart", "category": "Groceries", "subcategory": None},
    {"pattern": "amazon", "category": "Shopping", "subcategory": None},
    {"pattern": "flipkart", "category": "Shopping", "subcategory": None},
    {"pattern": "myntra", "category": "Shopping", "subcategory": None},
    {"pattern": "airtel", "category": "Bills", "subcategory": "Mobile"},
    {"pattern": "jio", "category": "Bills", "subcategory": "Mobile"},
    {"pattern": "vi", "category": "Bills", "subcategory": "Mobile"},
    {"pattern": "bsnl", "category": "Bills", "subcategory": "Mobile"},
    {"pattern": "bescom", "category": "Bills", "subcategory": "Electricity"},
    {"pattern": "mseb", "category": "Bills", "subcategory": "Electricity"},
    {"pattern": "tata power", "category": "Bills", "subcategory": "Electricity"},
    {"pattern": "adani electricity", "category": "Bills", "subcategory": "Electricity"},
    {"pattern": "irctc", "category": "Travel", "subcategory": "Tickets"},
    {"pattern": "bookmyshow", "category": "Entertainment", "subcategory": "Movies"},
    {"pattern": "apollo", "category": "Healthcare", "subcategory": "Medicine"},
    {"pattern": "medplus", "category": "Healthcare", "subcategory": "Medicine"},
    {"pattern": "pharmeasy", "category": "Healthcare", "subcategory": "Medicine"},
]


async def seed_user_defaults(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Seeds default categories, subcategories, and category classification rules for a new user."""
    category_map: dict[str, Category] = {}
    subcategory_map: dict[str, dict[str, Category]] = {}

    for cat_data in DEFAULT_CATEGORIES_DATA:
        parent_cat = Category(
            user_id=user_id,
            parent_id=None,
            name=cat_data["name"],
            icon=cat_data["icon"],
            color=cat_data["color"],
            sort_order=cat_data["sort_order"],
            is_default=True,
        )
        session.add(parent_cat)
        await session.flush()  # populate parent_cat.id

        category_map[parent_cat.name] = parent_cat
        subcategory_map[parent_cat.name] = {}

        subcats: list[str] = cat_data["subcategories"]  # type: ignore[assignment]
        for idx, sub_name in enumerate(subcats, start=1):
            sub_cat = Category(
                user_id=user_id,
                parent_id=parent_cat.id,
                name=sub_name,
                icon=parent_cat.icon,
                color=parent_cat.color,
                sort_order=idx,
                is_default=True,
            )
            session.add(sub_cat)
            await session.flush()
            subcategory_map[parent_cat.name][sub_name] = sub_cat

    # Seed category rules
    for rule_data in DEFAULT_CATEGORY_RULES_DATA:
        cat_name = rule_data["category"]
        if not cat_name or cat_name not in category_map:
            continue
        parent_cat = category_map[cat_name]
        target_sub_cat: Category | None = None
        rule_sub_name = rule_data["subcategory"]
        if rule_sub_name and rule_sub_name in subcategory_map[parent_cat.name]:
            target_sub_cat = subcategory_map[parent_cat.name][rule_sub_name]

        rule = CategoryRule(
            user_id=user_id,
            pattern=rule_data["pattern"] or "",
            category_id=parent_cat.id,
            subcategory_id=target_sub_cat.id if target_sub_cat else None,
            priority=0,
            source="user",
        )
        session.add(rule)
