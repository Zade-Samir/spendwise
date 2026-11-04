import logging
import secrets
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_v1_router
from app.api.v1.health import router as root_health_router
from app.core.config import settings
from app.core.db import engine
from app.core.errors import register_error_handlers
from app.core.logging import request_id_ctx_var, setup_logging
from app.core.rate_limit import RateLimitMiddleware
from app.jobs.recurring_job import start_scheduler, stop_scheduler

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager handling startup and shutdown hooks."""
    setup_logging(settings.LOG_LEVEL)
    logger.info("Starting SpendWise API [%s] on port %s", settings.ENV, settings.PORT)
    start_scheduler()

    yield

    logger.info("Shutting down SpendWise API; disposing database engine pools.")
    stop_scheduler()
    await engine.dispose()


def create_application() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        description="SpendWise Personal Expense Tracking & Financial Intelligence REST API",
        docs_url="/docs" if settings.ENV != "production" else None,
        redoc_url="/redoc" if settings.ENV != "production" else None,
        lifespan=lifespan,
    )

    # CORS configuration
    origins = [settings.FRONTEND_ORIGIN]
    if settings.ENV == "development":
        origins.extend(["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"])

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting middleware
    app.add_middleware(RateLimitMiddleware)

    # Security headers middleware
    @app.middleware("http")
    async def security_headers_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; connect-src 'self' http: https: ws:;"
        )
        return response

    # Correlation ID middleware
    @app.middleware("http")
    async def correlation_id_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        req_id = request.headers.get("X-Request-ID") or f"req_{secrets.token_urlsafe(12)}"
        token = request_id_ctx_var.set(req_id)
        try:
            response: Response = await call_next(request)
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_ctx_var.reset(token)

    # Register standardized error handlers
    register_error_handlers(app)

    # Include routers
    app.include_router(root_health_router, prefix="/health", tags=["Health"])
    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_application()
