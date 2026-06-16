import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import auth as auth_module
from app.api import observations as observations_router_module
from app.core.database import Base
from app.models.observation import Observation
from app.models.school import School
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


@pytest.fixture
def observation_db() -> Session:
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
def observation_client(observation_db: Session):
    test_app = FastAPI()
    test_app.include_router(observations_router_module.router, prefix="/api")

    def override_get_db():
        try:
            yield observation_db
        finally:
            pass

    test_app.dependency_overrides[observations_router_module.get_db] = override_get_db
    test_app.dependency_overrides[auth_module.get_current_user] = lambda: TEACHER_RESPONSE

    with TestClient(test_app) as client:
        yield client


def seed_school_and_user(db: Session, school_id: int, user_id: int, email: str):
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
            is_superuser=False,
            school_id=school_id,
        )
    )
    db.commit()


def test_create_observation_endpoint_creates_observation_for_current_school(
    observation_client: TestClient,
    observation_db: Session,
):
    seed_school_and_user(observation_db, 1, 1, "teacher@example.com")

    response = observation_client.post(
        "/api/observations",
        json={
            "title": "Lezen",
            "description": "Leest vlot korte zinnen",
            "observation_date": "2026-06-12",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["school_id"] == 1
    assert data["created_by"] == 1
    assert data["title"] == "Lezen"
    assert data["description"] == "Leest vlot korte zinnen"
    assert data["observation_date"] == "2026-06-12"
    assert data["created_at"] is not None
    assert observation_db.query(Observation).count() == 1


def test_list_observations_endpoint_only_returns_current_school_observations(
    observation_client: TestClient,
    observation_db: Session,
):
    seed_school_and_user(observation_db, 1, 1, "teacher@example.com")
    seed_school_and_user(observation_db, 2, 2, "teacher2@example.com")

    observation_client.app.dependency_overrides[auth_module.get_current_user] = lambda: UserResponse(
        id=1,
        email="teacher@example.com",
        name="Teacher",
        is_active=True,
        is_superuser=False,
        school_id=1,
    )
    observation_client.post(
        "/api/observations",
        json={
            "title": "School 1 observation",
            "description": "Only visible in school 1",
            "observation_date": "2026-06-10",
        },
    )

    observation_client.app.dependency_overrides[auth_module.get_current_user] = lambda: UserResponse(
        id=2,
        email="teacher2@example.com",
        name="Teacher 2",
        is_active=True,
        is_superuser=False,
        school_id=2,
    )
    second_response = observation_client.post(
        "/api/observations",
        json={
            "title": "School 2 observation",
            "description": "Only visible in school 2",
            "observation_date": "2026-06-11",
        },
    )

    list_response = observation_client.get("/api/observations")

    assert list_response.status_code == 200
    assert list_response.json() == [second_response.json()]
    assert observation_db.query(Observation).count() == 2


def test_create_observation_endpoint_requires_school(
    observation_client: TestClient,
    observation_db: Session,
):
    observation_client.app.dependency_overrides[auth_module.get_current_user] = lambda: UserResponse(
        id=1,
        email="teacher@example.com",
        name="Teacher",
        is_active=True,
        is_superuser=False,
        school_id=None,
    )

    response = observation_client.post(
        "/api/observations",
        json={
            "title": "Lezen",
            "description": "Leest vlot korte zinnen",
            "observation_date": "2026-06-12",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Geen geldige school gekoppeld"
    assert observation_db.query(Observation).count() == 0


def test_create_observation_endpoint_rejects_unknown_school(
    observation_client: TestClient,
    observation_db: Session,
):
    observation_client.app.dependency_overrides[auth_module.get_current_user] = lambda: UserResponse(
        id=1,
        email="teacher@example.com",
        name="Teacher",
        is_active=True,
        is_superuser=False,
        school_id=999,
    )

    response = observation_client.post(
        "/api/observations",
        json={
            "title": "Lezen",
            "description": "Leest vlot korte zinnen",
            "observation_date": "2026-06-12",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "School niet gevonden"
    assert observation_db.query(Observation).count() == 0


def test_create_observation_endpoint_validates_required_fields(
    observation_client: TestClient,
    observation_db: Session,
):
    seed_school_and_user(observation_db, 1, 1, "teacher@example.com")

    response = observation_client.post(
        "/api/observations",
        json={
            "title": "",
            "description": "Leest vlot korte zinnen",
            "observation_date": "2026-06-12",
        },
    )

    assert response.status_code == 422
    assert observation_db.query(Observation).count() == 0
