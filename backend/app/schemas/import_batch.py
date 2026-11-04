import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.enums import ImportStatus, PaymentMethod


class ColumnMapping(BaseModel):
    date: str
    description: str
    amount: str | None = None
    debit: str | None = None
    credit: str | None = None


class DetectedDialect(BaseModel):
    delimiter: str
    encoding: str
    date_format: str


class ImportUploadResponse(BaseModel):
    batch_id: uuid.UUID
    filename: str
    headers: list[str]
    sample_rows: list[list[str]]
    suggested_mapping: ColumnMapping
    detected: DetectedDialect


class ImportPreviewRequest(BaseModel):
    mapping: ColumnMapping
    date_format: str = "DD/MM/YYYY"
    amount_mode: Literal["debit_credit", "single_column"] = "debit_credit"
    skip_credits: bool = True


class ImportPreviewRow(BaseModel):
    row_no: int
    date: str
    amount_minor: int
    description: str
    payment_method: PaymentMethod = PaymentMethod.UPI
    suggested_category_id: uuid.UUID | None = None
    suggested_subcategory_id: uuid.UUID | None = None
    is_duplicate: bool = False
    duplicate_of_txn_id: uuid.UUID | None = None
    error: str | None = None


class ImportPreviewStats(BaseModel):
    total: int
    valid: int
    duplicates: int
    errors: int


class ImportPreviewResponse(BaseModel):
    rows: list[ImportPreviewRow]
    stats: ImportPreviewStats


class ImportCommitRow(BaseModel):
    row_no: int
    category_id: uuid.UUID
    subcategory_id: uuid.UUID | None = None
    include: bool = True


class ImportCommitRequest(BaseModel):
    rows: list[ImportCommitRow]
    skip_duplicates: bool = True


class ImportCommitResponse(BaseModel):
    imported: int
    skipped: int
    duplicates: int


class ImportBatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    status: ImportStatus
    row_count: int
    imported_count: int
    duplicate_count: int
    skipped_count: int
    created_at: datetime.datetime
    committed_at: datetime.datetime | None = None
