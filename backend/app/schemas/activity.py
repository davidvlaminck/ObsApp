from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ActivityGoalItem(BaseModel):
    goal_id: int = Field(ge=1)
    label: str | None = Field(default=None, max_length=200)
    observe: bool = False


class ActivityCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    theme_id: int = Field(ge=1)
    goal_items: list[ActivityGoalItem] = Field(default_factory=list, max_length=50)


class ActivityUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    theme_id: int = Field(ge=1)
    goal_items: list[ActivityGoalItem] | None = Field(default=None, max_length=50)


class ActivityGoalResponse(BaseModel):
    id: int
    goal_id: int | None = None
    label: str | None = None
    observe: bool = False
    code: str | None = None
    title: str | None = None
    goal_type: str | None = None


class ActivityResponse(BaseModel):
    id: int
    school_id: int
    name: str
    description: Optional[str] = None
    theme_id: Optional[int] = None
    theme: Optional[dict] = None
    goals: list[ActivityGoalResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
