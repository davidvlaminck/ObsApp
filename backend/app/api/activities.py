from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.auth import get_current_school_user
from app.core.database import get_db
from app.models.goal import Goal
from app.models.school import School
from app.repositories.activity_repository import ActivityRepository
from app.repositories.theme_repository import ThemeRepository
from app.schemas.activity import ActivityCreate, ActivityResponse, ActivityUpdate
from app.schemas.user import UserResponse

router = APIRouter(prefix="/activities", tags=["activities"])


def _get_school_koepel_slug(db: Session, school_id: int) -> str | None:
    school = db.query(School.koepel).filter(School.id == school_id).first()
    return school[0] if school else None


@router.get("/available-goals", response_model=list[dict])
def list_available_goals(
    subject: str | None = None,
    domain: str | None = None,
    subdomain: str | None = None,
    q: str | None = None,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    repo = ActivityRepository(db)
    koepel_slug = _get_school_koepel_slug(db, current_user.school_id)
    goals = repo.get_available_goals(current_user.school_id, koepel_slug)

    if subject:
        goals = [goal for goal in goals if goal.subject == subject]
    if domain:
        goals = [goal for goal in goals if goal.domain == domain]
    if subdomain:
        goals = [goal for goal in goals if goal.subdomain == subdomain]
    if q and q.strip():
        term = q.strip().lower()
        goals = [
            goal
            for goal in goals
            if term in goal.title.lower()
            or term in goal.code.lower()
            or (goal.description and term in goal.description.lower())
        ]

    return [
        {
            "id": goal.id,
            "code": goal.code,
            "title": goal.title,
            "subject": goal.subject,
            "domain": goal.domain,
            "subdomain": goal.subdomain,
            "goal_type": goal.goal_type,
        }
        for goal in goals
    ]


@router.get("/subjects", response_model=list[str])
def list_activity_subjects(
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    repo = ActivityRepository(db)
    koepel_slug = _get_school_koepel_slug(db, current_user.school_id)
    goals = repo.get_available_goals(current_user.school_id, koepel_slug)
    return sorted({goal.subject for goal in goals if goal.subject})


@router.get("/domains", response_model=list[str])
def list_activity_domains(
    subject: str | None = None,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    repo = ActivityRepository(db)
    koepel_slug = _get_school_koepel_slug(db, current_user.school_id)
    goals = repo.get_available_goals(current_user.school_id, koepel_slug)
    if subject:
        goals = [goal for goal in goals if goal.subject == subject]
    return sorted({goal.domain for goal in goals if goal.domain})


@router.get("/subdomains", response_model=list[str])
def list_activity_subdomains(
    subject: str | None = None,
    domain: str | None = None,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    repo = ActivityRepository(db)
    koepel_slug = _get_school_koepel_slug(db, current_user.school_id)
    goals = repo.get_available_goals(current_user.school_id, koepel_slug)
    if subject:
        goals = [goal for goal in goals if goal.subject == subject]
    if domain:
        goals = [goal for goal in goals if goal.domain == domain]
    return sorted({goal.subdomain for goal in goals if goal.subdomain})


@router.get("", response_model=list[ActivityResponse])
@router.get("/", response_model=list[ActivityResponse])
def list_activities(
    theme_id: int | None = None,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    repo = ActivityRepository(db)
    return [repo.to_response(activity) for activity in repo.get_all(current_user.school_id, theme_id=theme_id)]


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(
    payload: ActivityCreate,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    repo = ActivityRepository(db)
    theme_repo = ThemeRepository(db)

    if not theme_repo.get_by_id(payload.theme_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thema niet gevonden")

    activity = repo.create(
        school_id=current_user.school_id,
        name=payload.name,
        description=payload.description,
        theme_id=payload.theme_id,
        goal_items=[item.model_dump() for item in payload.goal_items],
        created_by=current_user.id,
    )
    return repo.to_response(activity)


@router.get("/{activity_id}", response_model=ActivityResponse)
def get_activity(
    activity_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    repo = ActivityRepository(db)
    activity = repo.get_by_id(activity_id, current_user.school_id)
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden")
    return repo.to_response(activity)


@router.put("/{activity_id}", response_model=ActivityResponse)
def update_activity(
    activity_id: int,
    payload: ActivityUpdate,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    repo = ActivityRepository(db)
    activity = repo.get_by_id(activity_id, current_user.school_id)
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden")

    if payload.theme_id != activity.theme_id:
        theme_repo = ThemeRepository(db)
        if not theme_repo.get_by_id(payload.theme_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thema niet gevonden")

    updated = repo.update(
        activity,
        name=payload.name,
        description=payload.description,
        theme_id=payload.theme_id,
        goal_items=[item.model_dump() for item in payload.goal_items] if payload.goal_items is not None else None,
        created_by=current_user.id,
    )
    return repo.to_response(updated)


@router.delete("/{activity_id}/observation-goals/{observation_goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity_observation_goal(
    activity_id: int,
    observation_goal_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    repo = ActivityRepository(db)
    activity = repo.get_by_id(activity_id, current_user.school_id)
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden")
    repo.delete_observation_goal_link(activity, observation_goal_id)


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    activity_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    repo = ActivityRepository(db)
    activity = repo.get_by_id(activity_id, current_user.school_id)
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activiteit niet gevonden")
    repo.delete(activity)
