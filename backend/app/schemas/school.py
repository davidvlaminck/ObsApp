from datetime import datetime

from pydantic import BaseModel, Field


class SchoolCreate(BaseModel):
    name: str = Field(min_length=1)
    slug: str | None = Field(default=None, min_length=1, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    is_active: bool = True


class SchoolResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_active: bool
    created_at: datetime | None = None
