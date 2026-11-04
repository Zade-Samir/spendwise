import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.budget import (
    BudgetListResponse,
    BudgetResponse,
    BudgetUpsertRequest,
)
from app.services.budgets import (
    delete_budget,
    get_budgets_with_status,
    upsert_budget,
)

router = APIRouter()


@router.get(
    "",
    response_model=BudgetListResponse,
    summary="List all active budgets with live spending status",
)
async def list_budgets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetListResponse:
    """Returns active budgets (overall and category) with live calculations of spent, remaining, safe daily, and alert status."""
    return await get_budgets_with_status(db, current_user)


@router.put("", response_model=BudgetResponse, summary="Upsert overall or category budget")
async def create_or_update_budget(
    payload: BudgetUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BudgetResponse:
    """Creates or updates a monthly or weekly budget for the authenticated user."""
    return await upsert_budget(db, current_user, payload)


@router.delete(
    "/{budget_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an active budget"
)
async def remove_budget(
    budget_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deletes the specified budget belonging to the authenticated user."""
    await delete_budget(db, current_user, budget_id)
