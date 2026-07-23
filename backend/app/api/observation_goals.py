from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.core.database import get_db
from app.repositories.goal_repository import GoalRepository
from app.repositories.observation_goal_repository import ObservationGoalRepository
from app.repositories.school_goal_domain_repository import SchoolGoalDomainRepository
from app.repositories.school_repository import SchoolRepository
from app.repositories.school_year_repository import (
    ClassRepository,
    SchoolYearRepository,
    StudentRepository,
)
from app.repositories.student_observation_repository import StudentObservationRepository
from app.schemas.goal import GoalResponse
from app.schemas.observation_goal import ObservationGoalCreate, ObservationGoalResponse
from app.schemas.school import ClassResponse
from app.schemas.school_goal_domain import SchoolGoalDomainCreate, SchoolGoalDomainResponse, SchoolGoalDomainUpdate
from app.schemas.student_observation import ObservationContextResponse, OverviewResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/observation-goals", tags=["observation-goals"])


def _ensure_school_user(current_user: UserResponse) -> int:
    if current_user.school_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geen geldige school gekoppeld",
        )
    return current_user.school_id


def _ensure_teacher_user(current_user: UserResponse) -> int:
    if current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superusers moeten zich eerst als leerkracht identificeren.",
        )
    return _ensure_school_user(current_user)


@router.post("", response_model=ObservationGoalResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ObservationGoalResponse, status_code=status.HTTP_201_CREATED)
def create_observation_goal(
    payload: ObservationGoalCreate,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_school_user(current_user)
    if not SchoolRepository(db).get_by_id(school_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School niet gevonden")

    repo = ObservationGoalRepository(db)
    if current_user.is_demo:
        existing_count = repo.count_by_school(school_id)
        if existing_count >= 20:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Als demo gebruiker kan je tot 10 doelen zelf aanmaken en gebruiken.",
            )

    try:
        observation_goal = repo.create(payload, school_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return repo.to_response(observation_goal)


@router.get("", response_model=list[ObservationGoalResponse])
@router.get("/", response_model=list[ObservationGoalResponse])
def list_observation_goals(
    subject: str | None = None,
    domain: str | None = None,
    subdomain: str | None = None,
    q: str | None = None,
    class_id: int | None = None,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_school_user(current_user)
    repo = ObservationGoalRepository(db)
    return [
        repo.to_response(goal)
        for goal in repo.get_all(
            school_id, subject=subject, domain=domain, subdomain=subdomain, q=q, class_id=class_id
        )
    ]


@router.get("/observe/context", response_model=ObservationContextResponse)
def get_observation_context(
    class_id: int | None = None,
    subject: str | None = None,
    domain: str | None = None,
    selected_goal_id: int | None = None,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_teacher_user(current_user)
    if not SchoolRepository(db).get_by_id(school_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School niet gevonden")

    class_info = None
    students = []
    if class_id:
        class_repo = ClassRepository(db)
        class_model = class_repo.get_class_by_id(class_id)
        if not class_model:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Klas niet gevonden")

        school_year = SchoolYearRepository(db).get_by_id(class_model.school_year_id)
        if not school_year or school_year.school_id != school_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Niet bevoegd")

        class_info = class_repo.class_to_response(class_model)
        students = [
            StudentRepository(db).to_response(student)
            for student in StudentRepository(db).get_by_class(class_id)
        ]

    repo = ObservationGoalRepository(db)
    goals = repo.get_for_observing(school_id, class_id=class_id, subject=subject, domain=domain)
    student_observations = {}
    if class_id and selected_goal_id:
        student_observations = StudentObservationRepository(db).get_latest_statuses_for_students(
            school_id,
            class_id,
            observation_goal_id=selected_goal_id,
        )

    return ObservationContextResponse(
        goals=[repo.to_response(goal) for goal in goals],
        students=students,
        student_observations=student_observations,
        class_info=class_info,
    )


@router.get("/classes", response_model=list[ClassResponse])
def list_observation_goal_classes(
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_school_user(current_user)
    class_repo = ClassRepository(db)
    year_repo = SchoolYearRepository(db)

    school_years = year_repo.get_school_years_by_school(school_id)
    class_ids = []
    for year in school_years:
        class_ids.extend([cls.id for cls in class_repo.get_classes_by_school_year(year.id)])

    classes = [class_repo.get_class_by_id(cid) for cid in class_ids]
    return [class_repo.class_to_response(cls) for cls in classes if cls]


@router.get("/subjects", response_model=list[str])
def list_observation_goal_subjects(
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_school_user(current_user)
    return ObservationGoalRepository(db).get_subjects(school_id)


@router.get("/domains", response_model=list[str])
def list_observation_goal_domains(
    subject: str | None = None,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_school_user(current_user)
    return ObservationGoalRepository(db).get_domains(school_id, subject=subject)


@router.get("/subdomains", response_model=list[str])
def list_observation_goal_subdomains(
    subject: str | None = None,
    domain: str | None = None,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_school_user(current_user)
    return ObservationGoalRepository(db).get_subdomains(school_id, subject=subject, domain=domain)


@router.get("/managed-domains", response_model=list[SchoolGoalDomainResponse])
def list_managed_domains(
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_school_user(current_user)
    return SchoolGoalDomainRepository(db).get_all(school_id)


@router.post("/managed-domains", response_model=SchoolGoalDomainResponse, status_code=status.HTTP_201_CREATED)
def create_managed_domain(
    payload: SchoolGoalDomainCreate,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_school_user(current_user)
    if not SchoolRepository(db).get_by_id(school_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School niet gevonden")

    repo = SchoolGoalDomainRepository(db)
    domain = repo.create(payload, school_id)
    return repo.to_response(domain)


@router.put("/managed-domains/{domain_id}", response_model=SchoolGoalDomainResponse)
def update_managed_domain(
    domain_id: int,
    payload: SchoolGoalDomainUpdate,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_school_user(current_user)
    repo = SchoolGoalDomainRepository(db)
    domain = repo.get_by_id(domain_id, school_id)
    if not domain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domein niet gevonden")

    return repo.update(domain, payload)


@router.delete("/managed-domains/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_managed_domain(
    domain_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_school_user(current_user)
    repo = SchoolGoalDomainRepository(db)
    domain = repo.get_by_id(domain_id, school_id)
    if not domain:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domein niet gevonden")

    goal_repo = ObservationGoalRepository(db)
    attached_goals = goal_repo.get_all(school_id=school_id, domain=domain.name)
    if attached_goals:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Kan dit domein niet verwijderen omdat er nog observatiedoelen aan gekoppeld zijn.",
        )

    repo.delete(domain)


@router.delete("/{observation_goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_observation_goal(
    observation_goal_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_school_user(current_user)
    repo = ObservationGoalRepository(db)
    observation_goal = repo.get_by_id(observation_goal_id, school_id)
    if not observation_goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Observatiedoel niet gevonden"
        )

    repo.delete(observation_goal)


@router.get("/goals/search", response_model=list[GoalResponse])
def search_opstap_goals(
    subject: str | None = None,
    domain: str | None = None,
    subdomain: str | None = None,
    level: str | None = None,
    q: str | None = None,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    repo = ObservationGoalRepository(db)
    goals = repo.search_goals(subject=subject, domain=domain, subdomain=subdomain, level=level, q=q)
    return [GoalRepository(db).to_response(goal) for goal in goals]


@router.get("/overview", response_model=OverviewResponse)
def get_overview(
    class_id: int,
    subject: str | None = None,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    school_id = _ensure_teacher_user(current_user)
    if not SchoolRepository(db).get_by_id(school_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School niet gevonden")

    class_repo = ClassRepository(db)
    class_model = class_repo.get_class_by_id(class_id)
    if not class_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Klas niet gevonden")

    school_year = SchoolYearRepository(db).get_by_id(class_model.school_year_id)
    if not school_year or school_year.school_id != school_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Niet bevoegd")

    repo = StudentObservationRepository(db)
    goals, students, status_map = repo.get_overview_data(school_id, class_id, subject=subject)

    goal_responses = [ObservationGoalRepository(db).to_response(goal) for goal in goals]
    student_responses = [StudentRepository(db).to_response(student) for student in students]

    student_observations: dict[int, StudentObservationStatusResponse] = {}
    for (goal_id, student_id), status in status_map.items():
        student_observations[student_id] = status

    return OverviewResponse(
        goals=goal_responses,
        students=student_responses,
        student_observations=student_observations,
    )
