from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.api_tokens import router as api_tokens_router
from app.api.v1.auth import router as auth_router
from app.api.v1.budgets import router as budgets_router
from app.api.v1.categories import router as categories_router
from app.api.v1.exports import router as exports_router
from app.api.v1.health import router as health_router
from app.api.v1.imports import router as imports_router
from app.api.v1.insights import router as insights_router
from app.api.v1.push import router as push_router
from app.api.v1.recurring import router as recurring_router
from app.api.v1.settings import router as settings_router
from app.api.v1.shortcuts import router as shortcuts_router
from app.api.v1.transactions import router as transactions_router
from app.api.v1.users import router as users_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router, prefix="/health", tags=["Health"])
api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(categories_router)
api_v1_router.include_router(transactions_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(budgets_router, prefix="/budgets", tags=["Budgets"])
api_v1_router.include_router(insights_router, prefix="/insights", tags=["Insights"])
api_v1_router.include_router(imports_router, prefix="/imports", tags=["Imports"])
api_v1_router.include_router(exports_router, prefix="/exports", tags=["Exports"])
api_v1_router.include_router(recurring_router, prefix="/recurring", tags=["Recurring"])
api_v1_router.include_router(push_router)
api_v1_router.include_router(api_tokens_router)
api_v1_router.include_router(shortcuts_router)
api_v1_router.include_router(settings_router)

__all__ = ["api_v1_router"]
