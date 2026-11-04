import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Enum as SQLEnum

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import AccountType

if TYPE_CHECKING:
    from app.models.user import User


class Account(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[AccountType] = mapped_column(
        SQLEnum(
            AccountType,
            name="account_type",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        server_default=AccountType.BANK.value,
        default=AccountType.BANK,
    )
    opening_balance_minor: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default="0", default=0
    )
    archived_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship("User")


class Goal(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "goals"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    target_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    saved_minor: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default="0", default=0
    )
    target_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)

    user: Mapped["User"] = relationship("User")

    __table_args__ = (CheckConstraint("target_minor > 0", name="chk_goals_target_minor_positive"),)
