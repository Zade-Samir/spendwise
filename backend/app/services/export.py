import csv
import datetime
import io
import uuid
from typing import Any
from zoneinfo import ZoneInfo

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import PaymentMethod
from app.models.transaction import Transaction


def sanitize_csv_cell(value: Any) -> str:
    """Neutralizes formula injection attacks per spec §5.1.

    Any user-controlled string starting with '=', '+', '-', or '@'
    is prepended with a single quote (').
    """
    if value is None:
        return ""
    val_str = str(value)
    if val_str and val_str[0] in ("=", "+", "-", "@"):
        return f"'{val_str}"
    return val_str


class ExportService:
    @staticmethod
    async def get_filtered_transactions(
        session: AsyncSession,
        user_id: uuid.UUID,
        from_date: datetime.datetime | None = None,
        to_date: datetime.datetime | None = None,
        category_id: uuid.UUID | None = None,
        subcategory_id: uuid.UUID | None = None,
        payment_method: PaymentMethod | None = None,
        min_amount_minor: int | None = None,
        max_amount_minor: int | None = None,
        q: str | None = None,
    ) -> list[Transaction]:
        """Fetches active transactions filtered by criteria with strict user isolation."""
        stmt = (
            select(Transaction)
            .options(
                selectinload(Transaction.category),
                selectinload(Transaction.subcategory),
            )
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
            )
            .order_by(Transaction.occurred_at.desc())
        )

        if from_date:
            stmt = stmt.where(Transaction.occurred_at >= from_date)
        if to_date:
            stmt = stmt.where(Transaction.occurred_at < to_date)
        if category_id:
            stmt = stmt.where(Transaction.category_id == category_id)
        if subcategory_id:
            stmt = stmt.where(Transaction.subcategory_id == subcategory_id)
        if payment_method:
            stmt = stmt.where(Transaction.payment_method == payment_method)
        if min_amount_minor is not None:
            stmt = stmt.where(Transaction.amount_minor >= min_amount_minor)
        if max_amount_minor is not None:
            stmt = stmt.where(Transaction.amount_minor <= max_amount_minor)
        if q and q.strip():
            clean_q = f"%{q.strip().lower()}%"
            stmt = stmt.where(
                Transaction.merchant.ilike(clean_q)
                | Transaction.description.ilike(clean_q)
                | Transaction.notes.ilike(clean_q)
            )

        res = await session.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def export_csv(
        session: AsyncSession,
        user_id: uuid.UUID,
        user_tz: ZoneInfo = ZoneInfo("Asia/Kolkata"),
        **filters: Any,
    ) -> bytes:
        """Generates UTF-8 with BOM CSV export with formula injection defense."""
        transactions = await ExportService.get_filtered_transactions(session, user_id, **filters)

        output = io.StringIO()
        # UTF-8 BOM is written to bytes below
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        headers = [
            "Date",
            "Time",
            "Amount (INR)",
            "Category",
            "Subcategory",
            "Merchant",
            "Description",
            "Payment Method",
            "Notes",
            "Source",
        ]
        writer.writerow(headers)

        for tx in transactions:
            local_dt = tx.occurred_at.astimezone(user_tz)
            amount_inr = f"{tx.amount_minor / 100:.2f}"
            row = [
                local_dt.strftime("%Y-%m-%d"),
                local_dt.strftime("%H:%M:%S"),
                amount_inr,
                sanitize_csv_cell(tx.category.name if tx.category else "Uncategorized"),
                sanitize_csv_cell(tx.subcategory.name if tx.subcategory else ""),
                sanitize_csv_cell(tx.merchant or ""),
                sanitize_csv_cell(tx.description or ""),
                tx.payment_method.value.upper(),
                sanitize_csv_cell(tx.notes or ""),
                tx.source.value,
            ]
            writer.writerow(row)

        # Prepend UTF-8 BOM (\xef\xbb\xbf)
        csv_bytes = output.getvalue().encode("utf-8")
        return b"\xef\xbb\xbf" + csv_bytes

    @staticmethod
    async def export_xlsx(
        session: AsyncSession,
        user_id: uuid.UUID,
        user_tz: ZoneInfo = ZoneInfo("Asia/Kolkata"),
        **filters: Any,
    ) -> bytes:
        """Generates multi-sheet Excel workbook using openpyxl per spec §5.2."""
        transactions = await ExportService.get_filtered_transactions(session, user_id, **filters)

        wb = openpyxl.Workbook()

        # Styles
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
        bold_font = Font(name="Calibri", size=11, bold=True)
        center_align = Alignment(horizontal="center", vertical="center")
        right_align = Alignment(horizontal="right", vertical="center")
        thin_border = Border(
            left=Side(style="thin", color="E5E7EB"),
            right=Side(style="thin", color="E5E7EB"),
            top=Side(style="thin", color="E5E7EB"),
            bottom=Side(style="thin", color="E5E7EB"),
        )
        total_top_border = Border(
            top=Side(style="thin", color="374151"), bottom=Side(style="double", color="374151")
        )

        # -------------------------------------------------------------
        # Sheet 1: Transactions Ledger
        # -------------------------------------------------------------
        ws1 = wb.active
        if ws1 is None:
            ws1 = wb.create_sheet(title="Transactions")
        else:
            ws1.title = "Transactions"
        ws1.views.sheetView[0].showGridLines = True
        ws1.freeze_panes = "A2"

        tx_headers = [
            "Date",
            "Time",
            "Amount (INR)",
            "Category",
            "Subcategory",
            "Merchant",
            "Description",
            "Payment Method",
            "Notes",
            "Source",
        ]
        ws1.append(tx_headers)
        for col_num in range(1, len(tx_headers) + 1):
            cell = ws1.cell(row=1, column=col_num)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align

        total_minor = 0
        cat_aggregates: dict[str, dict[str, Any]] = {}
        month_aggregates: dict[str, dict[str, Any]] = {}

        for row_idx, tx in enumerate(transactions, start=2):
            local_dt = tx.occurred_at.astimezone(user_tz)
            amt_float = tx.amount_minor / 100.0
            total_minor += tx.amount_minor

            cat_name = tx.category.name if tx.category else "Uncategorized"
            month_key = local_dt.strftime("%Y-%m")

            # Aggregates for Sheet 2 & Sheet 3
            if cat_name not in cat_aggregates:
                cat_aggregates[cat_name] = {"name": cat_name, "minor": 0, "count": 0}
            cat_aggregates[cat_name]["minor"] += tx.amount_minor
            cat_aggregates[cat_name]["count"] += 1

            if month_key not in month_aggregates:
                month_aggregates[month_key] = {"month": month_key, "minor": 0, "count": 0}
            month_aggregates[month_key]["minor"] += tx.amount_minor
            month_aggregates[month_key]["count"] += 1

            row_data = [
                local_dt.strftime("%Y-%m-%d"),
                local_dt.strftime("%H:%M:%S"),
                amt_float,
                sanitize_csv_cell(cat_name),
                sanitize_csv_cell(tx.subcategory.name if tx.subcategory else ""),
                sanitize_csv_cell(tx.merchant or ""),
                sanitize_csv_cell(tx.description or ""),
                tx.payment_method.value.upper(),
                sanitize_csv_cell(tx.notes or ""),
                tx.source.value,
            ]
            ws1.append(row_data)

            # Format amount cell
            amt_cell = ws1.cell(row=row_idx, column=3)
            amt_cell.number_format = '[$₹-4009] #,##0.00;([$₹-4009] #,##0.00);"-";@'
            amt_cell.alignment = right_align

            for col_idx in range(1, len(row_data) + 1):
                ws1.cell(row=row_idx, column=col_idx).border = thin_border

        # -------------------------------------------------------------
        # Sheet 2: Category Summary
        # -------------------------------------------------------------
        ws2 = wb.create_sheet(title="Category Summary")
        ws2.views.sheetView[0].showGridLines = True
        cat_headers = ["Category", "Total Spent (INR)", "Transaction Count", "% of Total"]
        ws2.append(cat_headers)
        for col_num in range(1, len(cat_headers) + 1):
            cell = ws2.cell(row=1, column=col_num)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align

        sorted_cats = sorted(cat_aggregates.values(), key=lambda x: x["minor"], reverse=True)
        total_spent_float = total_minor / 100.0

        for r_idx, cdata in enumerate(sorted_cats, start=2):
            c_amt = cdata["minor"] / 100.0
            pct = (cdata["minor"] / total_minor * 100) if total_minor > 0 else 0.0
            ws2.append([cdata["name"], c_amt, cdata["count"], pct / 100.0])

            ws2.cell(row=r_idx, column=2).number_format = "[$₹-4009] #,##0.00"
            ws2.cell(row=r_idx, column=2).alignment = right_align
            ws2.cell(row=r_idx, column=3).alignment = center_align
            ws2.cell(row=r_idx, column=4).number_format = "0.0%"
            ws2.cell(row=r_idx, column=4).alignment = right_align

            for col_idx in range(1, len(cat_headers) + 1):
                ws2.cell(row=r_idx, column=col_idx).border = thin_border

        # Total summary row
        summary_row_idx = len(sorted_cats) + 2
        ws2.append(["Total", total_spent_float, len(transactions), 1.0 if total_minor > 0 else 0.0])
        for c in range(1, 5):
            cell = ws2.cell(row=summary_row_idx, column=c)
            cell.font = bold_font
            cell.border = total_top_border
        ws2.cell(row=summary_row_idx, column=2).number_format = "[$₹-4009] #,##0.00"
        ws2.cell(row=summary_row_idx, column=4).number_format = "0.0%"

        # -------------------------------------------------------------
        # Sheet 3: Monthly Summary
        # -------------------------------------------------------------
        ws3 = wb.create_sheet(title="Monthly Summary")
        ws3.views.sheetView[0].showGridLines = True
        month_headers = ["Month", "Total Spent (INR)", "Transaction Count"]
        ws3.append(month_headers)
        for col_num in range(1, len(month_headers) + 1):
            cell = ws3.cell(row=1, column=col_num)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = center_align

        sorted_months = sorted(month_aggregates.values(), key=lambda x: x["month"])
        for r_idx, mdata in enumerate(sorted_months, start=2):
            m_amt = mdata["minor"] / 100.0
            ws3.append([mdata["month"], m_amt, mdata["count"]])
            ws3.cell(row=r_idx, column=2).number_format = "[$₹-4009] #,##0.00"
            ws3.cell(row=r_idx, column=2).alignment = right_align
            ws3.cell(row=r_idx, column=3).alignment = center_align
            for col_idx in range(1, len(month_headers) + 1):
                ws3.cell(row=r_idx, column=col_idx).border = thin_border

        # Auto-adjust column widths on all sheets
        for ws in [ws1, ws2, ws3]:
            for col in ws.columns:
                max_len = 0
                col_letter = get_column_letter(col[0].column)
                for cell in col:
                    if cell.value:
                        val_str = str(cell.value)
                        max_len = max(max_len, len(val_str))
                ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

        out = io.BytesIO()
        wb.save(out)
        return out.getvalue()
