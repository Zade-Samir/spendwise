from fastapi import APIRouter

from app.core.config import settings
from app.core.db import check_database_health
from app.schemas.health import HealthCheckResponse

router = APIRouter()


@router.get("", response_model=HealthCheckResponse, summary="Service Health Check")
async def health_check() -> HealthCheckResponse:
    """Returns application health and database connection status."""
    db_healthy = await check_database_health()
    return HealthCheckResponse(
        status="ok",
        db="ok" if db_healthy else "degraded",
        environment=settings.ENV,
        version="0.1.0",
    )
