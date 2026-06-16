from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.observation_goal import ObservationGoalResponse
from app.schemas.school import ClassResponse, StudentResponse
from app.schemas.user import UserResponse


ObservationStatus = Literal["onvoldoende", "in_ontwikkeling", "zelfstandig", "voorsprong"]


class StudentObservationCreate(BaseModel):
    observation_goal_id: int
    student_id: int
    status: ObservationStatus
    observation_date: date
    comment: str | None = Field(default=None, max_length=2000)


class StudentObservationResponse(BaseModel):
    id: int
    school_id: int
    observation_goal_id: int
    student_id: int
    observed_by: int
    status: ObservationStatus
    observation_date: date
    comment: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    observation_goal: ObservationGoalResponse | None = None
    student: StudentResponse | None = None
    observer: UserResponse | None = None

    class Config:
        from_attributes = True


class StudentObservationStatusResponse(BaseModel):
    id: int
    observation_goal_id: int
    student_id: int
    status: ObservationStatus
    observation_date: date
    comment: str | None = None


class ObservationContextResponse(BaseModel):
    goals: list[ObservationGoalResponse]
    students: list[StudentResponse]
    student_observations: dict[int, StudentObservationStatusResponse] = Field(default_factory=dict)
    class_info: ClassResponse | None = None


class OverviewResponse(BaseModel):
    goals: list[ObservationGoalResponse]
    students: list[StudentResponse]
    student_observations: dict[int, StudentObservationStatusResponse] = Field(default_factory=dict)
