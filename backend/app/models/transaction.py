import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Enum as SQLEnum

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import PaymentMethod, TxnSource

if TYPE_CHECKING:
    from app.models.account import Account
    from app.models.category import Category
    from app.models.import_batch import ImportBatch
    from app.models.recurring import RecurringRule
    from app.models.user import User


class Transaction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "transactions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    category_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    subcategory_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    merchant: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    occurred_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.datetime.now(datetime.UTC),
        nullable=False,
    )
    source: Mapped[TxnSource] = mapped_column(
        SQLEnum(
            TxnSource,
            name="txn_source",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        server_default=TxnSource.MANUAL.value,
        default=TxnSource.MANUAL,
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    import_batch_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True
    )
    recurring_rule_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("recurring_rules.id", ondelete="SET NULL"), nullable=True
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    dedupe_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship("User")
    category: Mapped["Category"] = relationship("Category", foreign_keys=[category_id])
    subcategory: Mapped["Category | None"] = relationship("Category", foreign_keys=[subcategory_id])
    import_batch: Mapped["ImportBatch | None"] = relationship("ImportBatch")
    recurring_rule: Mapped["RecurringRule | None"] = relationship("RecurringRule")
    account: Mapped["Account | None"] = relationship("Account")

    __table_args__ = (
        CheckConstraint("amount_minor > 0", name="chk_transactions_amount_positive"),
        Index(
            "uq_transactions_user_client_id",
            "user_id",
            "client_id",
            unique=True,
            postgresql_where=text("client_id IS NOT NULL"),
        ),
        Index(
            "idx_transactions_user_occurred",
            "user_id",
            text("occurred_at DESC"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "idx_transactions_user_cat_occurred",
            "user_id",
            "category_id",
            text("occurred_at DESC"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("idx_transactions_user_dedupe", "user_id", "dedupe_hash"),
        Index(
            "idx_transactions_trgm_search",
            text(
                "((COALESCE(merchant, ''::text) || ' '::text) || COALESCE(description, ''::text))"
            ),
            postgresql_using="gin",
            postgresql_ops={
                "((COALESCE(merchant, ''::text) || ' '::text) || COALESCE(description, ''::text))": "gin_trgm_ops"
            },
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
