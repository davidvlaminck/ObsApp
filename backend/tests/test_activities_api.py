import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.activities import router as activity_router
from app.api import auth as auth_module
from app.core.database import Base, get_db
from app.models.activity import Activity
from app.models.goal import Goal
from app.models.school import School
from app.models.theme import Theme
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
def activity_db() -> Session:
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
def activity_client(activity_db: Session):
    test_app = FastAPI()
    test_app.include_router(activity_router, prefix="/api")

    def override_get_db():
        try:
            yield activity_db
        finally:
            pass

    test_app.dependency_overrides[get_db] = override_get_db
    test_app.dependency_overrides[auth_module.get_current_user] = lambda: TEACHER_RESPONSE

    with TestClient(test_app) as client:
        yield client


def seed_school_and_theme(db: Session, school_id: int, user_id: int):
    school = School(
        id=school_id,
        name=f"School {school_id}",
        slug=f"school-{school_id}",
        is_active=True,
        koepel=None,
        koepel_id=None,
    )
    db.add(school)
    theme = Theme(id=1, name="De appel", description="Fruit", created_at=None)
    db.add(theme)
    db.commit()
    db.refresh(theme)


def test_create_activity_success(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)

    goal = Goal(id=1, code="WIS-K3-1.1", title="Getallen", subject="Wiskunde", goal_type="OP_STAP")
    activity_db.add(goal)
    activity_db.commit()

    response = activity_client.post(
        "/api/activities",
        json={"name": "Rekenen", "description": "Oefenen met getallen.", "theme_id": 1, "goal_ids": [1]},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Rekenen"
    assert data["theme_id"] == 1
    assert len(data["goals"]) == 1


def test_list_activities_filters_by_theme(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    theme2 = Theme(id=2, name="De mol", description="Dier", created_at=None)
    activity_db.add(theme2)
    activity_db.commit()

    activity_client.post("/api/activities", json={"name": "A", "theme_id": 1})
    activity_client.post("/api/activities", json={"name": "B", "theme_id": 2})

    response = activity_client.get("/api/activities", params={"theme_id": 1})
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_update_activity_success(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    create_resp = activity_client.post("/api/activities", json={"name": "Oud"})
    activity_id = create_resp.json()["id"]

    response = activity_client.put(f"/api/activities/{activity_id}", json={"name": "Nieuw"})
    assert response.status_code == 200
    assert response.json()["name"] == "Nieuw"


def test_delete_activity_success(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    create_resp = activity_client.post("/api/activities", json={"name": "Te verwijderen"})
    activity_id = create_resp.json()["id"]

    response = activity_client.delete(f"/api/activities/{activity_id}")
    assert response.status_code == 204
    assert activity_db.query(Activity).count() == 0


def test_delete_activity_goal_success(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    goal = Goal(id=1, code="WIS-K3-1.1", title="Getallen", subject="Wiskunde", goal_type="OP_STAP")
    activity_db.add(goal)
    activity_db.commit()

    create_resp = activity_client.post("/api/activities", json={"name": "Act", "goal_ids": [1]})
    activity_id = create_resp.json()["id"]

    response = activity_client.delete(f"/api/activities/{activity_id}/goals/1")
    assert response.status_code == 204

    detail = activity_client.get(f"/api/activities/{activity_id}").json()
    assert len(detail["goals"]) == 0


def test_available_goals_for_katholiek_returns_opstap(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    school = activity_db.query(School).filter(School.id == 1).first()
    school.koepel = "katholiek-onderwijs-vlaanderen"
    activity_db.add(school)
    activity_db.commit()

    opstap = Goal(id=1, code="OP-1", title="Opstap", subject="Wiskunde", goal_type="OP_STAP")
    vo = Goal(id=2, code="VO-1", title="VO doel", subject="Wiskunde", goal_type="VO")
    activity_db.add_all([opstap, vo])
    activity_db.commit()

    response = activity_client.get("/api/activities/available-goals")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["goal_type"] == "OP_STAP"


def test_available_goals_for_non_katholiek_returns_vo(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    school = activity_db.query(School).filter(School.id == 1).first()
    school.koepel = "ovsg"
    activity_db.add(school)
    activity_db.commit()

    opstap = Goal(id=1, code="OP-1", title="Opstap", subject="Wiskunde", goal_type="OP_STAP")
    vo = Goal(id=2, code="VO-1", title="VO doel", subject="Wiskunde", goal_type="VO")
    activity_db.add_all([opstap, vo])
    activity_db.commit()

    response = activity_client.get("/api/activities/available-goals")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["goal_type"] == "VO"
