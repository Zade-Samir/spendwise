import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    SmallInteger,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Enum as SQLEnum

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import PaymentMethod, RecurFreq, RecurMode

if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.user import User


class RecurringRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "recurring_rules"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False
    )
    subcategory_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    merchant: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        SQLEnum(
            PaymentMethod,
            name="payment_method",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        server_default=PaymentMethod.UPI.value,
        default=PaymentMethod.UPI,
    )
    frequency: Mapped[RecurFreq] = mapped_column(
        SQLEnum(
            RecurFreq,
            name="recur_freq",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    interval_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="1", default=1
    )
    day_of_month: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    day_of_week: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    end_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    next_due_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    mode: Mapped[RecurMode] = mapped_column(
        SQLEnum(
            RecurMode,
            name="recur_mode",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        server_default=RecurMode.REMIND.value,
        default=RecurMode.REMIND,
    )
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true", default=True
    )

    user: Mapped["User"] = relationship("User")
    category: Mapped["Category"] = relationship("Category", foreign_keys=[category_id])
    subcategory: Mapped["Category | None"] = relationship("Category", foreign_keys=[subcategory_id])

    __table_args__ = (
        CheckConstraint("amount_minor > 0", name="chk_recurring_rules_amount_positive"),
        CheckConstraint("interval_count > 0", name="chk_recurring_rules_interval_count"),
        CheckConstraint("day_of_month BETWEEN 1 AND 31", name="chk_recurring_rules_day_of_month"),
        CheckConstraint("day_of_week BETWEEN 1 AND 7", name="chk_recurring_rules_day_of_week"),
        Index("idx_recurring_rules_due", "active", "next_due_date"),
    )
