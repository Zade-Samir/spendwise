import datetime
import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.core.time import get_user_timezone
from app.models.enums import PaymentMethod, TxnSource
from app.models.user import User
from app.schemas.transaction import (
    BulkDeleteRequest,
    BulkDeleteResponse,
    RecentMerchantItem,
    TransactionCreateRequest,
    TransactionListResponse,
    TransactionRead,
    TransactionUpdateRequest,
)
from app.services.transactions import (
    bulk_soft_delete,
    create_transaction,
    get_recent_merchants,
    get_transaction_by_id,
    list_transactions,
    restore_transaction,
    soft_delete_transaction,
    update_transaction,
)

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post(
    "",
    response_model=TransactionRead,
    summary="Create a new transaction or return existing if idempotent client_id",
)
async def post_create_transaction(
    payload: TransactionCreateRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TransactionRead:
    tx, is_created = await create_transaction(
        session=session,
        user_id=current_user.id,
        payload=payload,
    )
    if is_created:
        response.status_code = status.HTTP_201_CREATED
    else:
        response.status_code = status.HTTP_200_OK

    return TransactionRead.model_validate(tx)


@router.get(
    "",
    response_model=TransactionListResponse,
    status_code=status.HTTP_200_OK,
    summary="List paginated transactions with filters and totals",
)
async def get_transactions(
    q: str | None = Query(None, description="Fuzzy search query"),
    from_date: datetime.date | None = Query(
        None, alias="from", description="Start date (YYYY-MM-DD)"
    ),
    to_date: datetime.date | None = Query(None, alias="to", description="End date (YYYY-MM-DD)"),
    category_id: uuid.UUID | None = Query(None, description="Category filter"),
    subcategory_id: uuid.UUID | None = Query(None, description="Subcategory filter"),
    payment_method: list[PaymentMethod] | None = Query(None, description="Payment method filters"),
    min_amount_minor: int | None = Query(None, description="Minimum amount in paise"),
    max_amount_minor: int | None = Query(None, description="Maximum amount in paise"),
    source: TxnSource | None = Query(None, description="Transaction source"),
    sort: str = Query(
        "date_desc", description="Sort order: date_desc, date_asc, amount_desc, amount_asc"
    ),
    cursor: str | None = Query(None, description="Cursor for pagination"),
    limit: int = Query(50, ge=1, le=200, description="Page limit"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TransactionListResponse:
    user_tz = get_user_timezone(current_user.timezone)
    return await list_transactions(
        session=session,
        user_id=current_user.id,
        user_tz=user_tz,
        q=q,
        from_date=from_date,
        to_date=to_date,
        category_id=category_id,
        subcategory_id=subcategory_id,
        payment_methods=payment_method,
        min_amount_minor=min_amount_minor,
        max_amount_minor=max_amount_minor,
        source=source,
        sort=sort,
        cursor=cursor,
        limit=limit,
    )


@router.get(
    "/recent-merchants",
    response_model=list[RecentMerchantItem],
    status_code=status.HTTP_200_OK,
    summary="Get recent unique merchants with last used category",
)
async def get_merchants(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[RecentMerchantItem]:
    return await get_recent_merchants(
        session=session,
        user_id=current_user.id,
        limit=limit,
    )


@router.get(
    "/{id}",
    response_model=TransactionRead,
    status_code=status.HTTP_200_OK,
    summary="Get single transaction by ID",
)
async def get_single_transaction(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TransactionRead:
    tx = await get_transaction_by_id(
        session=session,
        user_id=current_user.id,
        transaction_id=id,
    )
    return TransactionRead.model_validate(tx)


@router.patch(
    "/{id}",
    response_model=TransactionRead,
    status_code=status.HTTP_200_OK,
    summary="Update transaction details",
)
async def patch_single_transaction(
    id: uuid.UUID,
    payload: TransactionUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TransactionRead:
    tx = await update_transaction(
        session=session,
        user_id=current_user.id,
        transaction_id=id,
        payload=payload,
    )
    return TransactionRead.model_validate(tx)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete transaction",
)
async def delete_single_transaction(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> Response:
    await soft_delete_transaction(
        session=session,
        user_id=current_user.id,
        transaction_id=id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{id}/restore",
    response_model=TransactionRead,
    status_code=status.HTTP_200_OK,
    summary="Restore soft-deleted transaction (Undo)",
)
async def post_restore_transaction(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> TransactionRead:
    tx = await restore_transaction(
        session=session,
        user_id=current_user.id,
        transaction_id=id,
    )
    return TransactionRead.model_validate(tx)


@router.post(
    "/bulk-delete",
    response_model=BulkDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Soft-delete multiple transactions",
)
async def post_bulk_delete(
    payload: BulkDeleteRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> BulkDeleteResponse:
    count = await bulk_soft_delete(
        session=session,
        user_id=current_user.id,
        transaction_ids=payload.ids,
    )
    return BulkDeleteResponse(deleted=count)
