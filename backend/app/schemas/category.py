import datetime
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CategoryChildRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    icon: str
    color: str
    sort_order: int
    is_default: bool
    archived_at: datetime.datetime | None = None
    usage_count_30d: int = 0


class CategoryTreeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    icon: str
    color: str
    sort_order: int
    is_default: bool
    archived_at: datetime.datetime | None = None
    usage_count_30d: int = 0
    children: list[CategoryChildRead] = Field(default_factory=list)


class CategoryCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    icon: str = Field(..., min_length=1, max_length=50)
    color: str = Field(..., min_length=4, max_length=20)
    parent_id: uuid.UUID | None = None


class CategoryUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    icon: str | None = Field(default=None, min_length=1, max_length=50)
    color: str | None = Field(default=None, min_length=4, max_length=20)
    sort_order: int | None = None
    archived: bool | None = None


class CategorySuggestionResponse(BaseModel):
    category_id: uuid.UUID | None = None
    subcategory_id: uuid.UUID | None = None
    confidence: Literal["rule", "history"] | None = None
