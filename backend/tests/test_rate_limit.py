import logging
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.logging import SensitiveDataFilter
from app.core.rate_limit import limiter
from app.main import app


@pytest.mark.asyncio
async def test_security_headers_present() -> None:
    """Verifies that all required hardened security headers are returned on responses."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        res = await client.get("/health")
        assert res.status_code == 200
        assert res.headers.get("X-Content-Type-Options") == "nosniff"
        assert res.headers.get("X-Frame-Options") == "DENY"
        assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert "geolocation=()" in res.headers.get("Permissions-Policy", "")
        assert "default-src 'self'" in res.headers.get("Content-Security-Policy", "")


@pytest.mark.asyncio
async def test_auth_rate_limiting_enforcement(async_client: AsyncClient) -> None:
    """Verifies that authentication endpoints enforce the 10 requests/minute limit."""
    limiter.reset()
    test_ip = f"192.168.1.{uuid.uuid4().int % 250 + 1}"
    client_headers = {
        "X-Test-Bypass-Rate-Limit": "false",
        "X-Forwarded-For": test_ip,
    }

    # First 10 attempts should proceed normally (e.g. 422 validation error or 401)
    for _ in range(10):
        res = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@spendwise.app", "password": "wrongpassword"},
            headers=client_headers,
        )
        assert res.status_code in (401, 422)

    # 11th attempt must be rejected with 429 Too Many Requests
    rate_limited_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@spendwise.app", "password": "wrongpassword"},
        headers=client_headers,
    )
    assert rate_limited_res.status_code == 429
    data = rate_limited_res.json()
    assert data["error"]["code"] == "RATE_LIMITED"
    assert "Retry-After" in rate_limited_res.headers

    limiter.reset()


def test_sensitive_log_data_sanitization() -> None:
    """Verifies SensitiveDataFilter redacts passwords, tokens, and authorization headers."""
    filter_instance = SensitiveDataFilter()

    # Test msg redaction
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="User login attempt with password=SecretPassword123! and token=abc123token",
        args=(),
        exc_info=None,
    )
    filter_instance.filter(record)
    assert "SecretPassword123!" not in record.msg
    assert "[REDACTED]" in record.msg

    # Test sw_ token redaction
    token_record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="Shortcut authorized via sw_1234567890abcdef1234567890abcdef",
        args=(),
        exc_info=None,
    )
    filter_instance.filter(token_record)
    assert "1234567890abcdef" not in token_record.msg
    assert "sw_[REDACTED]" in token_record.msg

    # Test args tuple redaction
    args_record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="Received auth header: %s",
        args=("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_payload.dummy_signature",),
        exc_info=None,
    )
    filter_instance.filter(args_record)
    assert "dummy_payload" not in str(args_record.args)
    assert "[REDACTED]" in str(args_record.args)
