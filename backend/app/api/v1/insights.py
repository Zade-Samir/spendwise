from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.insight import InsightListResponse
from app.services.insights import generate_spending_insights

router = APIRouter()


@router.get(
    "", response_model=InsightListResponse, summary="Retrieve statistical spending insights"
)
async def get_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InsightListResponse:
    """Generates up to 8 deterministic spending insights based on current month's transactions and comparison periods."""
    return await generate_spending_insights(db, current_user)
