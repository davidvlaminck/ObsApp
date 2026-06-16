from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class GoalSummary(BaseModel):
    id: int
    code: str
    title: str
    description: Optional[str] = None
    subject: str
    level: Optional[str] = None
    domain: Optional[str] = None
    subdomain: Optional[str] = None
    cluster: Optional[str] = None
    goal_type: str
    doel_soort: Optional[str] = None
    vo_code: Optional[str] = None

    class Config:
        from_attributes = True


class ObservationGoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    subject: str = Field(min_length=1, max_length=100)
    domain: str = Field(min_length=1, max_length=200)
    subdomain: str = Field(min_length=1, max_length=100)
    goal_id: Optional[int] = None


class ObservationGoalUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    subject: Optional[str] = Field(default=None, min_length=1, max_length=100)
    domain: Optional[str] = Field(default=None, min_length=1, max_length=200)
    subdomain: Optional[str] = Field(default=None, min_length=1, max_length=100)
    goal_id: Optional[int] = None


class ObservationGoalResponse(BaseModel):
    id: int
    school_id: int
    created_by: int
    name: str
    subject: str
    domain: str
    subdomain: str
    goal_id: Optional[int] = None
    goal: Optional[GoalSummary] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
