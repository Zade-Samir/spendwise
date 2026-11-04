import datetime
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import Enum as SQLEnum

from app.models.base import Base, UUIDPrimaryKeyMixin
from app.models.enums import ImportStatus

if TYPE_CHECKING:
    from app.models.user import User


class ImportBatch(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "import_batches"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ImportStatus] = mapped_column(
        SQLEnum(
            ImportStatus,
            name="import_status",
            native_enum=True,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        server_default=ImportStatus.UPLOADED.value,
        default=ImportStatus.UPLOADED,
    )
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0", default=0)
    imported_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0", default=0
    )
    duplicate_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0", default=0
    )
    skipped_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0", default=0
    )
    column_mapping: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    raw_rows: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    committed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship("User")

    __table_args__ = (Index("idx_import_batches_user", "user_id", text("created_at DESC")),)
