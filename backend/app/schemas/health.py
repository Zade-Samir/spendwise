from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = Field(default="ok", description="Overall application health status")
    db: str = Field(default="ok", description="Database connection status")
    environment: str = Field(default="development", description="Runtime environment")
    version: str = Field(default="0.1.0", description="Application version")
