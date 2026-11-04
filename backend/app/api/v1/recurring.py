import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.recurring import (
    RecurringConfirmRequest,
    RecurringRuleCreateRequest,
    RecurringRuleResponse,
    RecurringRuleUpdateRequest,
)
from app.schemas.transaction import TransactionRead
from app.services.recurring import RecurringService

router = APIRouter()


@router.get("", response_model=list[RecurringRuleResponse], summary="List all recurring rules")
async def list_recurring_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RecurringRuleResponse]:
    """Returns all scheduled recurring rules for the authenticated user."""
    return await RecurringService.list_rules(session=db, user_id=current_user.id)


@router.post(
    "",
    response_model=RecurringRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a recurring rule",
)
async def create_recurring_rule(
    payload: RecurringRuleCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecurringRuleResponse:
    """Creates a new recurring expense rule with schedule and month-end day clamping calculations."""
    return await RecurringService.create_rule(session=db, user_id=current_user.id, payload=payload)


@router.get(
    "/due",
    response_model=list[RecurringRuleResponse],
    summary="List due recurring rules awaiting user confirmation",
)
async def get_due_recurring_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RecurringRuleResponse]:
    """Returns recurring rules in 'remind' mode where next_due_date <= today, powering the Dashboard due card."""
    return await RecurringService.get_due_rules(session=db, user_id=current_user.id)


@router.patch("/{rule_id}", response_model=RecurringRuleResponse, summary="Update recurring rule")
async def update_recurring_rule(
    rule_id: uuid.UUID,
    payload: RecurringRuleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecurringRuleResponse:
    """Updates an existing recurring rule."""
    return await RecurringService.update_rule(
        session=db,
        user_id=current_user.id,
        rule_id=rule_id,
        payload=payload,
    )


@router.delete(
    "/{rule_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete recurring rule"
)
async def delete_recurring_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deletes the specified recurring rule."""
    await RecurringService.delete_rule(session=db, user_id=current_user.id, rule_id=rule_id)


@router.post(
    "/{rule_id}/confirm",
    response_model=TransactionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Confirm due recurring payment",
)
async def confirm_recurring_payment(
    rule_id: uuid.UUID,
    payload: RecurringConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TransactionRead:
    """Confirms payment, inserts a transaction with source='recurring', and advances next_due_date."""
    tx = await RecurringService.confirm_rule(
        session=db,
        user_id=current_user.id,
        rule_id=rule_id,
        payload=payload,
    )
    return TransactionRead.model_validate(tx)


@router.post(
    "/{rule_id}/skip", response_model=RecurringRuleResponse, summary="Skip recurring payment cycle"
)
async def skip_recurring_payment(
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecurringRuleResponse:
    """Skips the current cycle without creating a transaction and advances next_due_date."""
    return await RecurringService.skip_rule(
        session=db,
        user_id=current_user.id,
        rule_id=rule_id,
    )
