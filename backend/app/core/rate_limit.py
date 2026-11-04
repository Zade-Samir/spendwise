import time
from collections import defaultdict, deque

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from app.core.config import settings


class InMemoryRateLimiter:
    """Sliding-window in-memory rate limiter per client IP."""

    def __init__(self) -> None:
        self.auth_windows: dict[str, deque[float]] = defaultdict(deque)
        self.general_windows: dict[str, deque[float]] = defaultdict(deque)

    def is_allowed(self, ip: str, is_auth: bool) -> tuple[bool, int]:
        now = time.time()
        window = self.auth_windows[ip] if is_auth else self.general_windows[ip]
        limit = (
            settings.AUTH_RATE_LIMIT_PER_MINUTE
            if is_auth
            else settings.GENERAL_RATE_LIMIT_PER_MINUTE
        )

        # Evict timestamps older than 60 seconds
        cutoff = now - 60.0
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= limit:
            retry_after = int(60.0 - (now - window[0])) + 1
            return False, max(1, retry_after)

        window.append(now)
        return True, 0

    def reset(self) -> None:
        self.auth_windows.clear()
        self.general_windows.clear()


limiter = InMemoryRateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enforces sliding-window rate limits on API requests."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not settings.RATE_LIMITING_ENABLED:
            return await call_next(request)

        # Allow tests to bypass if explicitly requested via test header
        if request.headers.get("X-Test-Bypass-Rate-Limit") == "true":
            return await call_next(request)

        # Health checks, openapi docs and static files are exempt
        path = request.url.path
        if (
            path.startswith("/health")
            or path.startswith("/docs")
            or path.startswith("/redoc")
            or path == "/openapi.json"
        ):
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        is_auth = path.startswith(f"{settings.API_V1_PREFIX}/auth/login") or path.startswith(
            f"{settings.API_V1_PREFIX}/auth/register"
        )

        allowed, retry_after = limiter.is_allowed(client_ip, is_auth)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": "Too many requests. Please slow down and try again shortly.",
                    }
                },
                headers={"Retry-After": str(retry_after)},
            )

        return await call_next(request)

