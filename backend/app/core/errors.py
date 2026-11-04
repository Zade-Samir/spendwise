from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import request_id_ctx_var


class AppError(Exception):
    """Base application exception for all domain and HTTP errors."""

    def __init__(
        self,
        message: str,
        code: str = "server_error",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        fields: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.fields = fields or {}


class ValidationError(AppError):
    """Raised when incoming parameters or entities fail validation."""

    def __init__(self, message: str, fields: dict[str, Any] | None = None) -> None:
        super().__init__(
            message=message,
            code="validation_error",
            status_code=422,
            fields=fields,
        )


class UnauthorizedError(AppError):
    """Raised when authentication credentials are missing or invalid."""

    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__(
            message=message,
            code="unauthorized",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class ForbiddenError(AppError):
    """Raised when authenticated user lacks permissions or scope."""

    def __init__(self, message: str = "Access forbidden") -> None:
        super().__init__(
            message=message,
            code="forbidden",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class NotFoundError(AppError):
    """Raised when requested entity is not found or inaccessible."""

    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(
            message=message,
            code="not_found",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ConflictError(AppError):
    """Raised when an operation conflicts with existing entity state."""

    def __init__(self, message: str = "Resource conflict") -> None:
        super().__init__(
            message=message,
            code="conflict",
            status_code=status.HTTP_409_CONFLICT,
        )


class RateLimitedError(AppError):
    """Raised when rate limits are exceeded."""

    def __init__(self, message: str = "Too many requests. Please try again later.") -> None:
        super().__init__(
            message=message,
            code="rate_limited",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )


def format_error_response(
    code: str,
    message: str,
    status_code: int,
    fields: dict[str, Any] | None = None,
) -> JSONResponse:
    """Builds a standardized error response envelope."""
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id_ctx_var.get() or "unknown",
        }
    }
    if fields:
        payload["error"]["fields"] = fields

    return JSONResponse(status_code=status_code, content=payload)


def register_error_handlers(app: FastAPI) -> None:
    """Registers standard application error handlers with FastAPI."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return format_error_response(
            code=exc.code,
            message=exc.message,
            status_code=exc.status_code,
            fields=exc.fields,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        fields: dict[str, Any] = {}
        for err in exc.errors():
            loc = ".".join(str(x) for x in err.get("loc", []) if x not in ("body", "query"))
            fields[loc or "body"] = err.get("msg", "Invalid value")

        return format_error_response(
            code="validation_error",
            message="Request validation failed",
            status_code=422,
            fields=fields,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        return format_error_response(
            code="server_error",
            message="An unexpected internal server error occurred.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
