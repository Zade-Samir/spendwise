import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root_health_check(async_client: AsyncClient) -> None:
    """Verifies that GET /health returns 200 OK and valid health payload."""
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "db" in data
    assert "version" in data
    assert "environment" in data
    assert "X-Request-ID" in response.headers


@pytest.mark.asyncio
async def test_api_v1_health_check(async_client: AsyncClient) -> None:
    """Verifies that GET /api/v1/health returns 200 OK."""
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "db" in data
    assert data["version"] == "0.1.0"
