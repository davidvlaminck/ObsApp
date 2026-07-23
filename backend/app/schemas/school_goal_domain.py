from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SchoolGoalDomainBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class SchoolGoalDomainCreate(SchoolGoalDomainBase):
    pass


class SchoolGoalDomainUpdate(SchoolGoalDomainBase):
    pass


class SchoolGoalDomainResponse(SchoolGoalDomainBase):
    id: int
    school_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
