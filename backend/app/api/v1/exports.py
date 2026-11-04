import datetime
import uuid
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.enums import PaymentMethod
from app.models.user import User
from app.services.export import ExportService

router = APIRouter()


@router.get(
    "/transactions.csv", summary="Export transactions as UTF-8 CSV with formula injection defense"
)
async def export_transactions_csv(
    from_date: datetime.datetime | None = Query(None, alias="from"),
    to_date: datetime.datetime | None = Query(None, alias="to"),
    category_id: uuid.UUID | None = None,
    subcategory_id: uuid.UUID | None = None,
    payment_method: PaymentMethod | None = None,
    min_amount_minor: int | None = None,
    max_amount_minor: int | None = None,
    q: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Exports filtered transaction history to clean CSV with UTF-8 BOM and spreadsheet formula defense."""
    user_tz = ZoneInfo(current_user.timezone or "Asia/Kolkata")
    csv_bytes = await ExportService.export_csv(
        session=db,
        user_id=current_user.id,
        user_tz=user_tz,
        from_date=from_date,
        to_date=to_date,
        category_id=category_id,
        subcategory_id=subcategory_id,
        payment_method=payment_method,
        min_amount_minor=min_amount_minor,
        max_amount_minor=max_amount_minor,
        q=q,
    )

    filename = f"spendwise_transactions_{datetime.datetime.now(datetime.UTC).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/transactions.xlsx", summary="Export transactions as multi-sheet Excel workbook")
async def export_transactions_xlsx(
    from_date: datetime.datetime | None = Query(None, alias="from"),
    to_date: datetime.datetime | None = Query(None, alias="to"),
    category_id: uuid.UUID | None = None,
    subcategory_id: uuid.UUID | None = None,
    payment_method: PaymentMethod | None = None,
    min_amount_minor: int | None = None,
    max_amount_minor: int | None = None,
    q: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Exports filtered transaction history to a multi-sheet formatted Excel workbook (Ledger, Category Summary, Monthly Summary)."""
    user_tz = ZoneInfo(current_user.timezone or "Asia/Kolkata")
    xlsx_bytes = await ExportService.export_xlsx(
        session=db,
        user_id=current_user.id,
        user_tz=user_tz,
        from_date=from_date,
        to_date=to_date,
        category_id=category_id,
        subcategory_id=subcategory_id,
        payment_method=payment_method,
        min_amount_minor=min_amount_minor,
        max_amount_minor=max_amount_minor,
        q=q,
    )

    filename = f"spendwise_transactions_{datetime.datetime.now(datetime.UTC).strftime('%Y%m%d_%H%M%S')}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
