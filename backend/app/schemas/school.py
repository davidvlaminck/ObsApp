from datetime import date, datetime

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


class SchoolYearCreate(BaseModel):
    name: str = Field(min_length=1)
    start_date: date
    end_date: date
    is_active: bool = False


class SchoolYearResponse(BaseModel):
    id: int
    school_id: int
    name: str
    start_date: date
    end_date: date
    is_active: bool
    created_at: datetime | None = None


class ClassCreate(BaseModel):
    name: str = Field(min_length=1)


class ClassResponse(BaseModel):
    id: int
    school_year_id: int
    name: str
    created_at: datetime | None = None
