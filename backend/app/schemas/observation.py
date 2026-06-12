from datetime import date, datetime

from pydantic import BaseModel, Field


class ObservationCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    observation_date: date


class ObservationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    description: str | None = Field(default=None, min_length=1)
    observation_date: date | None = None


class ObservationResponse(BaseModel):
    id: int
    school_id: int
    created_by: int
    title: str
    description: str
    observation_date: date
    created_at: datetime | None = None
    updated_at: datetime | None = None
