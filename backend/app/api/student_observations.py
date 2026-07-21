from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.core.database import get_db
from app.repositories.school_repository import SchoolRepository
from app.repositories.student_observation_repository import StudentObservationRepository
from app.schemas.student_observation import StudentObservationCreate, StudentObservationResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/student-observations", tags=["student-observations"])


def _ensure_teacher_user(current_user: UserResponse) -> int:
    if current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superusers moeten zich eerst als leerkracht identificeren.",
        )
    if current_user.school_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geen geldige school gekoppeld",
        )
    return current_user.school_id


@router.post("", response_model=StudentObservationResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=StudentObservationResponse, status_code=status.HTTP_201_CREATED)
def create_student_observation(
    payload: StudentObservationCreate,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_teacher_user(current_user)
    if not SchoolRepository(db).get_by_id(school_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School niet gevonden")

    repo = StudentObservationRepository(db)
    try:
        observation = repo.create(payload, school_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return repo.to_response(observation)


@router.get("", response_model=list[StudentObservationResponse])
@router.get("/", response_model=list[StudentObservationResponse])
def list_student_observations(
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_teacher_user(current_user)
    return [
        StudentObservationRepository(db).to_response(observation)
        for observation in StudentObservationRepository(db).get_all(school_id)
    ]


@router.get("/{student_observation_id}", response_model=StudentObservationResponse)
def get_student_observation(
    student_observation_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_teacher_user(current_user)
    observation = StudentObservationRepository(db).get_by_id(student_observation_id, school_id)
    if not observation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observatie niet gevonden")
    return StudentObservationRepository(db).to_response(observation)


@router.delete("/{student_observation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student_observation(
    student_observation_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_teacher_user(current_user)
    repo = StudentObservationRepository(db)
    observation = repo.get_by_id(student_observation_id, school_id)
    if not observation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observatie niet gevonden")
    repo.delete(observation)
