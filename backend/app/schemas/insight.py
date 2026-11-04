from typing import Any, Literal

from pydantic import BaseModel, Field


class InsightItem(BaseModel):
    id: str
    kind: str
    severity: Literal["info", "warning", "positive"]
    title: str
    body: str
    data: dict[str, Any] = Field(default_factory=dict)
    generated_for: str


class InsightListResponse(BaseModel):
    items: list[InsightItem]
