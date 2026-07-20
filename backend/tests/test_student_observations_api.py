import pytest
from datetime import date
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import auth as auth_module
from app.api import observation_goals as observation_goals_router_module
from app.api import student_observations as student_observations_router_module
from app.core.database import Base
from app.models.goal import Goal
from app.models.observation_goal import ObservationGoal
from app.models.school import School
from app.models.school_year import Class, SchoolYear, Student
from app.models.student_observation import StudentObservation
from app.models.user import User
from app.schemas.user import UserResponse


TEACHER_RESPONSE = UserResponse(
    id=1,
    email="teacher@example.com",
    name="Teacher",
    is_active=True,
    is_superuser=False,
    school_id=1,
)

SUPERUSER_RESPONSE = UserResponse(
    id=9,
    email="admin@example.com",
    name="Admin",
    is_active=True,
    is_superuser=True,
    school_id=1,
)


@pytest.fixture
def student_observation_db() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def student_observation_client(student_observation_db: Session):
    test_app = FastAPI()
    test_app.include_router(observation_goals_router_module.router, prefix="/api")
    test_app.include_router(student_observations_router_module.router, prefix="/api")

    def override_get_db():
        try:
            yield student_observation_db
        finally:
            pass

    test_app.dependency_overrides[observation_goals_router_module.get_db] = override_get_db
    test_app.dependency_overrides[student_observations_router_module.get_db] = override_get_db
    test_app.dependency_overrides[auth_module.get_current_user] = lambda: TEACHER_RESPONSE

    with TestClient(test_app) as client:
        yield client


def seed_school_and_user(
    db: Session, school_id: int, user_id: int, email: str, is_superuser: bool = False
):
    db.add(
        School(
            id=school_id,
            name=f"School {school_id}",
            slug=f"school-{school_id}",
            is_active=True,
        )
    )
    db.add(
        User(
            id=user_id,
            email=email,
            hashed_password="hashed",
            name=f"Teacher {school_id}",
            is_active=True,
            is_superuser=is_superuser,
            school_id=school_id,
        )
    )
    db.commit()


def seed_observation_context(db: Session):
    seed_school_and_user(db, 1, 1, "teacher@example.com")
    seed_school_and_user(db, 2, 2, "teacher2@example.com")

    school_year = SchoolYear(
        id=1,
        school_id=1,
        name="2026-2027",
        start_date=date(2026, 9, 1),
        end_date=date(2027, 6, 30),
        is_active=True,
    )
    db.add(school_year)

    class_model = Class(id=1, school_year_id=school_year.id, name="3K", class_type="K3")
    db.add(class_model)

    student = Student(id=1, class_id=class_model.id, name="Lena Peeters")
    db.add(student)

    goal = Goal(
        id=1,
        code="WIS-K3-1.1.1",
        title="Getallen vergelijken",
        description="De leerling vergelijkt aantallen tot 20.",
        subject="Wiskunde",
        level="K3",
        domain="Getallen",
        subdomain="Vergelijken",
        goal_type="OP_STAP",
    )
    db.add(goal)

    observation_goal = ObservationGoal(
        id=1,
        school_id=1,
        created_by=1,
        name="Getallen vergelijken observeren",
        subject="Wiskunde",
        domain="Getallen",
        subdomain="Vergelijken",
        goal_id=goal.id,
    )
    db.add(observation_goal)
    db.commit()

    return {
        "class_id": class_model.id,
        "student_id": student.id,
        "observation_goal_id": observation_goal.id,
    }


def test_observation_context_returns_goals_and_students_for_teacher_school(
    student_observation_client: TestClient,
    student_observation_db: Session,
):
    context = seed_observation_context(student_observation_db)

    response = student_observation_client.get(
        "/api/observation-goals/observe/context",
        params={"class_id": context["class_id"], "subject": "Wiskunde"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["class_info"]["name"] == "3K"
    assert [goal["id"] for goal in data["goals"]] == [1]
    assert [student["id"] for student in data["students"]] == [1]
    assert data["goals"][0]["goal"]["code"] == "WIS-K3-1.1.1"


def test_observation_context_returns_latest_student_statuses_for_selected_goal(
    student_observation_client: TestClient,
    student_observation_db: Session,
):
    context = seed_observation_context(student_observation_db)
    student_observation_db.add(
        StudentObservation(
            school_id=1,
            observation_goal_id=context["observation_goal_id"],
            student_id=context["student_id"],
            observed_by=1,
            status="in_ontwikkeling",
            observation_date=date(2026, 6, 15),
            comment="Eerdere observatie.",
        )
    )
    student_observation_db.add(
        StudentObservation(
            school_id=1,
            observation_goal_id=context["observation_goal_id"],
            student_id=context["student_id"],
            observed_by=1,
            status="voldoende",
            observation_date=date(2026, 6, 16),
            comment="Laatste observatie.",
        )
    )
    student_observation_db.commit()

    response = student_observation_client.get(
        "/api/observation-goals/observe/context",
        params={
            "class_id": context["class_id"],
            "selected_goal_id": context["observation_goal_id"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["student_observations"]["1"] == {
        "id": 2,
        "observation_goal_id": context["observation_goal_id"],
        "student_id": context["student_id"],
        "status": "voldoende",
        "observation_date": "2026-06-16",
        "comment": "Laatste observatie.",
    }


def test_observation_context_rejects_superuser(
    student_observation_client: TestClient,
    student_observation_db: Session,
):
    seed_observation_context(student_observation_db)
    student_observation_client.app.dependency_overrides[auth_module.get_current_user] = lambda: (
        SUPERUSER_RESPONSE
    )

    response = student_observation_client.get("/api/observation-goals/observe/context")

    assert response.status_code == 403
    assert response.json()["detail"] == "Superusers moeten zich eerst als leerkracht identificeren."


def test_create_student_observation_endpoint_creates_observation(
    student_observation_client: TestClient,
    student_observation_db: Session,
):
    context = seed_observation_context(student_observation_db)

    response = student_observation_client.post(
        "/api/student-observations",
        json={
            "observation_goal_id": context["observation_goal_id"],
            "student_id": context["student_id"],
            "status": "voldoende",
            "observation_date": "2026-06-16",
            "comment": "Kan voldoende vergelijken.",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["school_id"] == 1
    assert data["observed_by"] == 1
    assert data["status"] == "voldoende"
    assert data["observation_date"] == "2026-06-16"
    assert data["comment"] == "Kan voldoende vergelijken."
    assert student_observation_db.query(StudentObservation).count() == 1


def test_create_student_observation_endpoint_validates_status(
    student_observation_client: TestClient,
    student_observation_db: Session,
):
    context = seed_observation_context(student_observation_db)

    response = student_observation_client.post(
        "/api/student-observations",
        json={
            "observation_goal_id": context["observation_goal_id"],
            "student_id": context["student_id"],
            "status": "nog_niet_voldoende",
            "observation_date": "2026-06-16",
        },
    )

    assert response.status_code == 422
    assert student_observation_db.query(StudentObservation).count() == 0


def test_create_student_observation_rejects_goal_outside_school_scope(
    student_observation_client: TestClient,
    student_observation_db: Session,
):
    seed_observation_context(student_observation_db)
    goal = Goal(
        id=2,
        code="NED-K3-1.1.1",
        title="Luisteren",
        subject="Nederlands",
        level="K3",
        goal_type="OP_STAP",
    )
    student_observation_db.add(goal)
    student_observation_db.add(
        ObservationGoal(
            id=2,
            school_id=2,
            created_by=2,
            name="Luisteren school 2",
            subject="Nederlands",
            domain="Taal",
            subdomain="Luisteren",
            goal_id=goal.id,
        )
    )
    student_observation_db.commit()

    response = student_observation_client.post(
        "/api/student-observations",
        json={
            "observation_goal_id": 2,
            "student_id": 1,
            "status": "in_ontwikkeling",
            "observation_date": "2026-06-16",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Observatiedoel niet gevonden"
    assert student_observation_db.query(StudentObservation).count() == 0


def test_create_student_observation_rejects_goal_that_does_not_match_student_class(
    student_observation_client: TestClient,
    student_observation_db: Session,
):
    seed_observation_context(student_observation_db)
    goal = Goal(
        id=2,
        code="NED-K2-1.1.1",
        title="K2 doel",
        subject="Nederlands",
        level="K2",
        goal_type="OP_STAP",
    )
    student_observation_db.add(goal)
    student_observation_db.add(
        ObservationGoal(
            id=3,
            school_id=1,
            created_by=1,
            name="K2 doel",
            subject="Nederlands",
            domain="Taal",
            subdomain="Lezen",
            goal_id=goal.id,
        )
    )
    student_observation_db.commit()

    response = student_observation_client.post(
        "/api/student-observations",
        json={
            "observation_goal_id": 3,
            "student_id": 1,
            "status": "in_ontwikkeling",
            "observation_date": "2026-06-16",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Dit observatiedoel is niet beschikbaar voor deze klas"
    assert student_observation_db.query(StudentObservation).count() == 0


def test_create_student_observation_overwrites_existing_for_same_student_goal_date(
    student_observation_client: TestClient,
    student_observation_db: Session,
):
    context = seed_observation_context(student_observation_db)

    first_response = student_observation_client.post(
        "/api/student-observations",
        json={
            "observation_goal_id": context["observation_goal_id"],
            "student_id": context["student_id"],
            "status": "onvoldoende",
            "observation_date": "2026-06-16",
            "comment": "Eerste commentaar",
        },
    )
    assert first_response.status_code == 201
    assert student_observation_db.query(StudentObservation).count() == 1

    second_response = student_observation_client.post(
        "/api/student-observations",
        json={
            "observation_goal_id": context["observation_goal_id"],
            "student_id": context["student_id"],
            "status": "voldoende",
            "observation_date": "2026-06-16",
        },
    )
    assert second_response.status_code == 201
    data = second_response.json()
    assert data["status"] == "voldoende"
    assert data["comment"] == "Eerste commentaar"
    assert student_observation_db.query(StudentObservation).count() == 1


def test_create_student_observation_replaces_comment_when_provided(
    student_observation_client: TestClient,
    student_observation_db: Session,
):
    context = seed_observation_context(student_observation_db)

    student_observation_client.post(
        "/api/student-observations",
        json={
            "observation_goal_id": context["observation_goal_id"],
            "student_id": context["student_id"],
            "status": "onvoldoende",
            "observation_date": "2026-06-16",
            "comment": "Oude commentaar",
        },
    )

    response = student_observation_client.post(
        "/api/student-observations",
        json={
            "observation_goal_id": context["observation_goal_id"],
            "student_id": context["student_id"],
            "status": "in_ontwikkeling",
            "observation_date": "2026-06-16",
            "comment": "Nieuwe commentaar",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["comment"] == "Nieuwe commentaar"
    assert student_observation_db.query(StudentObservation).count() == 1
