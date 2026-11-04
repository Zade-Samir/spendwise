import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    SmallInteger,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Enum as SQLEnum

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import BudgetPeriod

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.user import User


class Budget(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "budgets"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), nullable=True, index=True
    )
    period: Mapped[BudgetPeriod] = mapped_column(
        SQLEnum(
            BudgetPeriod,
            name="budget_period",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        server_default=BudgetPeriod.MONTHLY.value,
        default=BudgetPeriod.MONTHLY,
    )
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    alert_threshold_pct: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="80", default=80
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true", default=True
    )

    user: Mapped["User"] = relationship("User")
    category: Mapped["Category | None"] = relationship("Category")

    __table_args__ = (
        CheckConstraint("amount_minor > 0", name="chk_budgets_amount_positive"),
        CheckConstraint(
            "alert_threshold_pct BETWEEN 50 AND 100", name="chk_budgets_alert_threshold"
        ),
        Index(
            "uq_budgets_user_cat_period",
            "user_id",
            text("COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid)"),
            "period",
            unique=True,
            postgresql_where=text("active = true"),
        ),
    )
