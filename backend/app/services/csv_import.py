import csv
import datetime
import hashlib
import io
import re
import uuid
from collections.abc import Sequence
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

from dateutil import parser as dateutil_parser
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.models.category import Category, CategoryRule
from app.models.enums import ImportStatus, PaymentMethod, TxnSource
from app.models.import_batch import ImportBatch
from app.models.transaction import Transaction
from app.schemas.import_batch import (
    ColumnMapping,
    DetectedDialect,
    ImportBatchResponse,
    ImportCommitRequest,
    ImportCommitResponse,
    ImportPreviewRequest,
    ImportPreviewResponse,
    ImportPreviewRow,
    ImportPreviewStats,
    ImportUploadResponse,
)

MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_ROWS = 5000

COMMON_DATE_FORMATS = [
    ("DD/MM/YYYY", "%d/%m/%Y"),
    ("DD-MM-YYYY", "%d-%m-%Y"),
    ("YYYY-MM-DD", "%Y-%m-%d"),
    ("DD MMM YYYY", "%d %b %Y"),
    ("DD MMMM YYYY", "%d %B %Y"),
    ("DD/MM/YY", "%d/%m/%y"),
    ("DD-MM-YY", "%d-%m-%y"),
]


def normalize_text_for_hash(text: str) -> str:
    """Lowercases text, collapses whitespace, and strips punctuation."""
    clean = re.sub(r"[^\w\s]", "", text.lower())
    return " ".join(clean.split())


def calculate_dedupe_hash(
    user_id: uuid.UUID,
    local_date: str,
    amount_minor: int,
    description: str,
) -> str:
    """Computes deduplication hash per spec §4.3."""
    norm_desc = normalize_text_for_hash(description)
    raw = f"{user_id}|{local_date}|{amount_minor}|{norm_desc}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def detect_encoding(content: bytes) -> str:
    """Detects encoding among utf-8-sig, utf-8, and latin-1."""
    if content.startswith(b"\xef\xbb\xbf"):
        return "utf-8-sig"
    try:
        content.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        return "latin-1"


def detect_delimiter(text_sample: str) -> str:
    """Sniffs the most probable CSV delimiter."""
    delimiters = [",", ";", "\t", "|"]
    counts = dict.fromkeys(delimiters, 0)
    lines = [line.strip() for line in text_sample.splitlines() if line.strip()][:10]
    for line in lines:
        for d in delimiters:
            counts[d] += line.count(d)
    best = max(counts, key=lambda k: counts[k])
    return best if counts[best] > 0 else ","


def guess_date_format(sample_dates: list[str]) -> tuple[str, str]:
    """Guesses date format from samples, returning (spec_format, strptime_format)."""
    scores: dict[str, int] = {}
    for spec_fmt, py_fmt in COMMON_DATE_FORMATS:
        score = 0
        for s in sample_dates:
            clean = s.strip()
            if not clean:
                continue
            try:
                datetime.datetime.strptime(clean, py_fmt)
                score += 1
            except ValueError:
                pass
        scores[spec_fmt] = score

    best_spec = max(scores, key=lambda k: scores[k])
    if scores[best_spec] > 0:
        py_fmt = next(p for s, p in COMMON_DATE_FORMATS if s == best_spec)
        return best_spec, py_fmt
    return "DD/MM/YYYY", "%d/%m/%Y"


def suggest_column_mapping(headers: list[str]) -> ColumnMapping:
    """Inspects header names to recommend a ColumnMapping."""
    date_patterns = [
        "date",
        "txn date",
        "transaction date",
        "value date",
        "trans date",
        "post date",
    ]
    desc_patterns = [
        "narration",
        "description",
        "particulars",
        "remarks",
        "details",
        "payee",
        "note",
        "transaction details",
    ]
    debit_patterns = [
        "withdrawal",
        "debit",
        "dr",
        "withdrawal amt",
        "debit amt",
        "withdrawal amount",
        "debit amount",
        "withdrawal (inr)",
    ]
    credit_patterns = [
        "deposit",
        "credit",
        "cr",
        "deposit amt",
        "credit amt",
        "deposit amount",
        "credit amount",
        "deposit (inr)",
    ]
    amount_patterns = ["amount", "txn amount", "net amount", "total", "amount (inr)"]

    mapping = ColumnMapping(date="", description="")

    for h in headers:
        lh = h.strip().lower()
        if not mapping.date and any(p == lh or p in lh for p in date_patterns):
            mapping.date = h
        elif not mapping.description and any(p == lh or p in lh for p in desc_patterns):
            mapping.description = h
        elif not mapping.debit and any(p == lh or p in lh for p in debit_patterns):
            mapping.debit = h
        elif not mapping.credit and any(p == lh or p in lh for p in credit_patterns):
            mapping.credit = h
        elif not mapping.amount and any(p == lh or p in lh for p in amount_patterns):
            mapping.amount = h

    # If date or description not found, fallback to first/second columns
    if not mapping.date and len(headers) > 0:
        mapping.date = headers[0]
    if not mapping.description and len(headers) > 1:
        mapping.description = headers[1]

    return mapping


def parse_clean_amount_minor(value_str: str) -> tuple[int, bool]:
    """Parses clean amount string into (amount_minor, is_debit).

    Negative values or strings with 'Dr' or enclosed in parentheses '(250)' are debits.
    Strings with 'Cr' or positive values are credits.
    """
    clean = value_str.strip()
    if not clean:
        return 0, False

    is_debit = False
    upper = clean.upper()
    if "DR" in upper:
        is_debit = True
        clean = re.sub(r"(?i)dr", "", clean).strip()
    elif "CR" in upper:
        is_debit = False
        clean = re.sub(r"(?i)cr", "", clean).strip()

    if clean.startswith("(") and clean.endswith(")"):
        is_debit = True
        clean = clean[1:-1].strip()

    # Strip currency signs, words & commas (preserving decimal dot and negative sign)
    clean = re.sub(r"(?i)(inr|rs\.?)", "", clean)
    clean = re.sub(r"[₹,\s]", "", clean).strip()
    if not clean:
        return 0, False

    try:
        dec = Decimal(clean)
        if dec < 0:
            is_debit = True
            dec = abs(dec)
        elif (
            not is_debit
            and "DR" not in upper
            and not (value_str.startswith("(") and value_str.endswith(")"))
        ):
            pass  # Positive number
        minor = int((dec * Decimal(100)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        return minor, is_debit
    except (InvalidOperation, ValueError):
        return 0, False


def extract_merchant(description: str) -> str | None:
    """Extracts candidate merchant from Indian UPI or card narrations."""
    clean = description.strip()
    # Pattern 1: UPI-MERCHANT-... or UPI/MERCHANT/...
    upi_match = re.search(r"UPI[-/]([A-Za-z0-9\s]+?)[-/@]", clean, re.IGNORECASE)
    if upi_match:
        m = upi_match.group(1).strip()
        if len(m) > 1 and not m.isdigit():
            return m.title()

    # Pattern 2: POS ... MERCHANT ...
    pos_match = re.search(r"POS\s+\d*\s*([A-Za-z0-9\s]+)", clean, re.IGNORECASE)
    if pos_match:
        words = pos_match.group(1).split()
        if words:
            return words[0].title()

    # Fallback to first 2 words if reasonable
    words = clean.split()
    if len(words) >= 1:
        first = words[0]
        if len(first) > 2 and not first.isdigit():
            return first.title()
    return None


def detect_payment_method(description: str) -> PaymentMethod:
    """Infers payment method from description keywords."""
    upper = description.upper()
    if "UPI" in upper or "@" in upper:
        return PaymentMethod.UPI
    if any(k in upper for k in ["POS", "DEBIT CARD", "CREDIT CARD", "VISA", "MASTERCARD", "RUPAY"]):
        return PaymentMethod.CARD
    if any(k in upper for k in ["NEFT", "RTGS", "IMPS", "ACH", "NETBANKING", "TRANSFER"]):
        return PaymentMethod.BANK_TRANSFER
    if "ATM" in upper or "CASH" in upper:
        return PaymentMethod.CASH
    return PaymentMethod.UPI


class CSVImportService:
    @staticmethod
    async def upload_file(
        session: AsyncSession,
        user_id: uuid.UUID,
        file_bytes: bytes,
        filename: str,
    ) -> ImportUploadResponse:
        """Validates, sniffs dialect, stages raw rows, and persists an ImportBatch."""
        if len(file_bytes) > MAX_FILE_SIZE:
            raise ValidationError(
                f"File size exceeds 2 MB limit (size: {len(file_bytes) / 1024 / 1024:.2f} MB)"
            )

        encoding = detect_encoding(file_bytes)
        try:
            text_content = file_bytes.decode(encoding)
        except Exception as e:
            raise ValidationError(
                f"Failed to decode file with detected encoding {encoding}: {e}"
            ) from e

        # Check delimiter
        delimiter = detect_delimiter(text_content)

        # Parse CSV lines
        reader = csv.reader(io.StringIO(text_content), delimiter=delimiter)
        all_rows: list[list[str]] = []
        for row in reader:
            if any(cell.strip() for cell in row):
                all_rows.append([cell.strip() for cell in row])

        if not all_rows:
            raise ValidationError("Uploaded CSV file is empty")

        headers = all_rows[0]
        data_rows = all_rows[1 : MAX_ROWS + 1]

        suggested_mapping = suggest_column_mapping(headers)

        # Sample dates for format guessing
        date_col_idx = (
            headers.index(suggested_mapping.date) if suggested_mapping.date in headers else 0
        )
        sample_dates = [r[date_col_idx] for r in data_rows[:20] if len(r) > date_col_idx]
        best_date_fmt, _ = guess_date_format(sample_dates)

        mapping_payload = suggested_mapping.model_dump()
        mapping_payload["_headers"] = headers

        # Create ImportBatch record
        batch = ImportBatch(
            user_id=user_id,
            filename=filename,
            status=ImportStatus.UPLOADED,
            row_count=len(data_rows),
            column_mapping=mapping_payload,
            raw_rows=data_rows,
        )
        session.add(batch)
        await session.commit()
        await session.refresh(batch)

        return ImportUploadResponse(
            batch_id=batch.id,
            filename=filename,
            headers=headers,
            sample_rows=data_rows[:5],
            suggested_mapping=suggested_mapping,
            detected=DetectedDialect(
                delimiter=delimiter,
                encoding=encoding,
                date_format=best_date_fmt,
            ),
        )

    @staticmethod
    async def preview_batch(
        session: AsyncSession,
        user_id: uuid.UUID,
        batch_id: uuid.UUID,
        request: ImportPreviewRequest,
    ) -> ImportPreviewResponse:
        """Parses staged rows using mapping, checks duplicate hashes, and suggests categories."""
        batch = await session.get(ImportBatch, batch_id)
        if not batch or batch.user_id != user_id:
            raise NotFoundError("Import batch not found")

        # Determine python strptime format from request.date_format
        py_date_fmt = next(
            (p for s, p in COMMON_DATE_FORMATS if s == request.date_format), "%d/%m/%Y"
        )

        # Load active category rules and default categories for auto-suggestion
        rules_stmt = (
            select(CategoryRule)
            .where(CategoryRule.user_id == user_id)
            .order_by(CategoryRule.priority.desc())
        )
        rules = (await session.execute(rules_stmt)).scalars().all()

        cats_stmt = (
            select(Category)
            .where(Category.user_id == user_id, Category.parent_id.is_(None))
            .order_by(Category.sort_order.asc())
        )
        default_categories = (await session.execute(cats_stmt)).scalars().all()
        fallback_cat_id = default_categories[0].id if default_categories else None

        # Pre-fetch existing dedupe hashes for this user
        existing_txs_stmt = select(Transaction.id, Transaction.dedupe_hash).where(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.dedupe_hash.is_not(None),
        )
        existing_res = await session.execute(existing_txs_stmt)
        dedupe_hash_to_tx_id = {row[1]: row[0] for row in existing_res.all() if row[1]}

        return await CSVImportService._process_preview_rows(
            session=session,
            user_id=user_id,
            batch=batch,
            request=request,
            rules=rules,
            fallback_cat_id=fallback_cat_id,
            dedupe_hash_to_tx_id=dedupe_hash_to_tx_id,
            py_date_fmt=py_date_fmt,
        )

    @staticmethod
    async def _process_preview_rows(
        session: AsyncSession,
        user_id: uuid.UUID,
        batch: ImportBatch,
        request: ImportPreviewRequest,
        rules: Sequence[CategoryRule],
        fallback_cat_id: uuid.UUID | None,
        dedupe_hash_to_tx_id: dict[str, uuid.UUID],
        py_date_fmt: str,
    ) -> ImportPreviewResponse:
        raw_rows = batch.raw_rows or []
        mapping = request.mapping

        # If column mapping was stored in batch, we can get the header list from it or dict keys
        headers = []
        if batch.column_mapping and "_headers" in batch.column_mapping:
            headers = batch.column_mapping["_headers"]

        # Helper to get value from row
        def get_val(r: Any, col_name: str | None) -> str:
            if not col_name:
                return ""
            if isinstance(r, dict):
                return str(r.get(col_name, "") or "").strip()
            if isinstance(r, list) and headers and col_name in headers:
                c_idx = headers.index(col_name)
                if c_idx < len(r):
                    return str(r[c_idx] or "").strip()
            return ""

        preview_rows: list[ImportPreviewRow] = []
        valid_count = 0
        duplicate_count = 0
        error_count = 0

        for idx, row in enumerate(raw_rows, start=1):
            date_str = get_val(row, mapping.date)
            desc_str = get_val(row, mapping.description)

            # Amount logic
            amount_minor = 0
            is_debit = False
            row_error: str | None = None

            if request.amount_mode == "debit_credit":
                debit_str = get_val(row, mapping.debit)
                credit_str = get_val(row, mapping.credit)

                if debit_str:
                    amount_minor, is_debit = parse_clean_amount_minor(debit_str)
                    is_debit = True  # explicitly from debit column
                elif credit_str:
                    amount_minor, _ = parse_clean_amount_minor(credit_str)
                    is_debit = False

                if not is_debit and request.skip_credits:
                    # Skip credit/deposit row
                    continue
            else:
                # Single column
                amount_str = get_val(row, mapping.amount)
                amount_minor, is_debit = parse_clean_amount_minor(amount_str)
                if not is_debit and request.skip_credits:
                    continue

            # Parse date
            parsed_date_iso = ""
            if not date_str:
                row_error = "Missing date value"
            else:
                try:
                    dt = datetime.datetime.strptime(date_str, py_date_fmt)
                    parsed_date_iso = dt.strftime("%Y-%m-%d")
                except ValueError:
                    try:
                        # Fallback to dateutil parser
                        dt = dateutil_parser.parse(date_str, dayfirst=True)
                        parsed_date_iso = dt.strftime("%Y-%m-%d")
                    except Exception:
                        row_error = f"Invalid date format: {date_str}"

            if not row_error and amount_minor <= 0:
                row_error = "Amount must be greater than zero"

            # Payment method inference
            pm = detect_payment_method(desc_str)

            # Deduplication hash calculation
            is_duplicate = False
            dup_id: uuid.UUID | None = None

            if not row_error:
                d_hash = calculate_dedupe_hash(user_id, parsed_date_iso, amount_minor, desc_str)
                if d_hash in dedupe_hash_to_tx_id:
                    is_duplicate = True
                    dup_id = dedupe_hash_to_tx_id[d_hash]
                    duplicate_count += 1
                else:
                    valid_count += 1
            else:
                error_count += 1

            # Category Auto-Suggestion
            suggested_cat_id = None
            suggested_subcat_id = None
            clean_desc_lower = desc_str.lower()

            for rule in rules:
                if rule.pattern.lower() in clean_desc_lower:
                    suggested_cat_id = rule.category_id
                    suggested_subcat_id = rule.subcategory_id
                    break

            if not suggested_cat_id:
                suggested_cat_id = fallback_cat_id

            preview_rows.append(
                ImportPreviewRow(
                    row_no=idx,
                    date=parsed_date_iso or date_str,
                    amount_minor=amount_minor,
                    description=desc_str,
                    payment_method=pm,
                    suggested_category_id=suggested_cat_id,
                    suggested_subcategory_id=suggested_subcat_id,
                    is_duplicate=is_duplicate,
                    duplicate_of_txn_id=dup_id,
                    error=row_error,
                )
            )

        # Update batch status and column_mapping
        batch.status = ImportStatus.MAPPED
        mapping_data = request.mapping.model_dump()
        mapping_data["date_format"] = request.date_format
        mapping_data["amount_mode"] = request.amount_mode
        mapping_data["skip_credits"] = request.skip_credits
        if headers:
            mapping_data["_headers"] = headers
        batch.column_mapping = mapping_data
        await session.commit()

        stats = ImportPreviewStats(
            total=len(preview_rows),
            valid=valid_count,
            duplicates=duplicate_count,
            errors=error_count,
        )

        return ImportPreviewResponse(rows=preview_rows, stats=stats)

    @staticmethod
    async def commit_batch(
        session: AsyncSession,
        user_id: uuid.UUID,
        batch_id: uuid.UUID,
        request: ImportCommitRequest,
    ) -> ImportCommitResponse:
        """Atomically commits selected preview rows to the transactions table."""
        batch = await session.get(ImportBatch, batch_id)
        if not batch or batch.user_id != user_id:
            raise NotFoundError("Import batch not found")

        if batch.status == ImportStatus.COMMITTED:
            raise ConflictError("This batch has already been committed")

        # Map commit choices by row_no
        commit_choices = {r.row_no: r for r in request.rows if r.include}

        # Re-run preview generation to obtain full parsed rows
        mapping_dict = batch.column_mapping or {}
        col_mapping = ColumnMapping(
            date=mapping_dict.get("date", ""),
            description=mapping_dict.get("description", ""),
            amount=mapping_dict.get("amount"),
            debit=mapping_dict.get("debit"),
            credit=mapping_dict.get("credit"),
        )
        prev_req = ImportPreviewRequest(
            mapping=col_mapping,
            date_format=mapping_dict.get("date_format", "DD/MM/YYYY"),
            amount_mode=mapping_dict.get("amount_mode", "debit_credit"),
            skip_credits=mapping_dict.get("skip_credits", True),
        )

        preview = await CSVImportService.preview_batch(session, user_id, batch_id, prev_req)

        imported = 0
        skipped = 0
        duplicates = 0

        # Validate categories to avoid foreign key errors
        categories_res = await session.execute(
            select(Category.id).where(Category.user_id == user_id)
        )
        valid_cat_ids = set(categories_res.scalars().all())

        new_txs: list[Transaction] = []
        for prow in preview.rows:
            choice = commit_choices.get(prow.row_no)
            if not choice or not choice.include:
                skipped += 1
                continue

            if prow.is_duplicate and request.skip_duplicates:
                duplicates += 1
                continue

            if prow.error or prow.amount_minor <= 0:
                skipped += 1
                continue

            cat_id = choice.category_id or prow.suggested_category_id
            if not cat_id or cat_id not in valid_cat_ids:
                # Use fallback
                if valid_cat_ids:
                    cat_id = next(iter(valid_cat_ids))
                else:
                    skipped += 1
                    continue

            # Parse occurred_at
            try:
                dt = datetime.datetime.strptime(prow.date, "%Y-%m-%d").replace(tzinfo=datetime.UTC)
            except Exception:
                dt = datetime.datetime.now(datetime.UTC)

            dedupe_hash = calculate_dedupe_hash(
                user_id, prow.date, prow.amount_minor, prow.description
            )

            tx = Transaction(
                user_id=user_id,
                amount_minor=prow.amount_minor,
                category_id=cat_id,
                subcategory_id=choice.subcategory_id,
                merchant=extract_merchant(prow.description),
                description=prow.description,
                payment_method=prow.payment_method,
                occurred_at=dt,
                source=TxnSource.CSV_IMPORT,
                import_batch_id=batch.id,
                dedupe_hash=dedupe_hash,
            )
            new_txs.append(tx)
            imported += 1

        session.add_all(new_txs)

        # Update batch record
        batch.status = ImportStatus.COMMITTED
        batch.imported_count = imported
        batch.duplicate_count = duplicates
        batch.skipped_count = skipped
        batch.committed_at = datetime.datetime.now(datetime.UTC)

        await session.commit()

        return ImportCommitResponse(
            imported=imported,
            skipped=skipped,
            duplicates=duplicates,
        )

    @staticmethod
    async def undo_batch(
        session: AsyncSession,
        user_id: uuid.UUID,
        batch_id: uuid.UUID,
    ) -> None:
        """Soft-deletes all transactions created from this import batch."""
        batch = await session.get(ImportBatch, batch_id)
        if not batch or batch.user_id != user_id:
            raise NotFoundError("Import batch not found")

        now_utc = datetime.datetime.now(datetime.UTC)
        stmt = (
            update(Transaction)
            .where(
                Transaction.user_id == user_id,
                Transaction.import_batch_id == batch_id,
                Transaction.deleted_at.is_(None),
            )
            .values(deleted_at=now_utc)
        )
        await session.execute(stmt)

        batch.status = ImportStatus.FAILED
        await session.commit()

    @staticmethod
    async def list_batches(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[ImportBatchResponse]:
        """Lists recent import batches for the user."""
        stmt = (
            select(ImportBatch)
            .where(ImportBatch.user_id == user_id)
            .order_by(ImportBatch.created_at.desc())
            .limit(20)
        )
        res = await session.execute(stmt)
        return [ImportBatchResponse.model_validate(b) for b in res.scalars().all()]
