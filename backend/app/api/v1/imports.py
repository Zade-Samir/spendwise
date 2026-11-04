import uuid

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.errors import ValidationError
from app.models.user import User
from app.schemas.import_batch import (
    ImportBatchResponse,
    ImportCommitRequest,
    ImportCommitResponse,
    ImportPreviewRequest,
    ImportPreviewResponse,
    ImportUploadResponse,
)
from app.services.csv_import import CSVImportService

router = APIRouter()


@router.post("", response_model=ImportUploadResponse, summary="Upload CSV statement for ingestion")
async def upload_statement(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImportUploadResponse:
    """Uploads a CSV statement file (≤ 2 MB, ≤ 5,000 rows), sniffs dialect, and returns suggested column mappings."""
    if not file.filename:
        raise ValidationError("Uploaded file must have a valid filename")

    content = await file.read()
    return await CSVImportService.upload_file(
        session=db,
        user_id=current_user.id,
        file_bytes=content,
        filename=file.filename,
    )


@router.post(
    "/{batch_id}/preview",
    response_model=ImportPreviewResponse,
    summary="Preview and evaluate import mapping",
)
async def preview_statement(
    batch_id: uuid.UUID,
    payload: ImportPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImportPreviewResponse:
    """Evaluates parsed rows against confirmed column mappings, calculates deduplication hashes, and flags duplicate transactions."""
    return await CSVImportService.preview_batch(
        session=db,
        user_id=current_user.id,
        batch_id=batch_id,
        request=payload,
    )


@router.post(
    "/{batch_id}/commit",
    response_model=ImportCommitResponse,
    summary="Commit import batch to transactions",
)
async def commit_statement(
    batch_id: uuid.UUID,
    payload: ImportCommitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImportCommitResponse:
    """Atomically commits chosen rows to the transactions ledger, skipping duplicates and updating batch statistics."""
    return await CSVImportService.commit_batch(
        session=db,
        user_id=current_user.id,
        batch_id=batch_id,
        request=payload,
    )


@router.get(
    "", response_model=list[ImportBatchResponse], summary="List recent statement import batches"
)
async def list_import_batches(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ImportBatchResponse]:
    """Returns recent import batches for the authenticated user."""
    return await CSVImportService.list_batches(
        session=db,
        user_id=current_user.id,
    )


@router.delete(
    "/{batch_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Undo and reverse an import batch",
)
async def undo_import_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-deletes all transactions associated with the import batch, cleanly reversing the import."""
    await CSVImportService.undo_batch(
        session=db,
        user_id=current_user.id,
        batch_id=batch_id,
    )
