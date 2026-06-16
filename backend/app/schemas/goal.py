from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class GoalBase(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    subject: str = Field(min_length=1, max_length=100)
    level: Optional[str] = Field(default=None, max_length=20)
    domain: Optional[str] = Field(default=None, max_length=200)
    subdomain: Optional[str] = Field(default=None, max_length=200)
    cluster: Optional[str] = Field(default=None, max_length=200)
    goal_type: str = Field(pattern="^(VO|OP_STAP)$")
    doel_soort: Optional[str] = Field(default=None, max_length=5)
    target_type: Optional[str] = Field(default=None, max_length=20)
    parent_goal_id: Optional[int] = None
    vo_code: Optional[str] = Field(default=None, max_length=50)
    minimum_goal_code: Optional[str] = Field(default=None, max_length=50)
    voorbeelden: Optional[str] = None
    vocabulary: Optional[str] = None
    valid_from: Optional[datetime] = None


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=50)
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    subject: Optional[str] = Field(default=None, min_length=1, max_length=100)
    level: Optional[str] = Field(default=None, max_length=20)
    domain: Optional[str] = Field(default=None, max_length=200)
    subdomain: Optional[str] = Field(default=None, max_length=200)
    cluster: Optional[str] = Field(default=None, max_length=200)
    goal_type: Optional[str] = Field(default=None, pattern="^(VO|OP_STAP)$")
    doel_soort: Optional[str] = Field(default=None, max_length=5)
    target_type: Optional[str] = Field(default=None, max_length=20)
    parent_goal_id: Optional[int] = None
    vo_code: Optional[str] = Field(default=None, max_length=50)
    minimum_goal_code: Optional[str] = Field(default=None, max_length=50)
    voorbeelden: Optional[str] = None
    vocabulary: Optional[str] = None
    valid_from: Optional[datetime] = None


class GoalResponse(GoalBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GoalWithParent(GoalResponse):
    parent_goal: Optional[GoalResponse] = None
