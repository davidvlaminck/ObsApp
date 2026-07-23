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
from app.models.observation_goal import ObservationGoal
from app.models.school import School
from app.models.theme import Theme
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
        json={"name": "Rekenen", "description": "Oefenen met getallen.", "theme_id": 1, "goal_items": [{"goal_id": 1, "label": None, "observe": False}]},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Rekenen"
    assert data["theme_id"] == 1
    assert len(data["goals"]) == 1
    assert data["goals"][0]["label"] == "Getallen"
    assert data["goals"][0]["observe"] is False


def test_create_activity_requires_theme_id(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)

    response = activity_client.post(
        "/api/activities",
        json={"name": "Rekenen", "goal_items": [{"goal_id": 1, "observe": True}]},
    )
    assert response.status_code == 422


def test_create_activity_with_observe_creates_observation_goal(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)

    goal = Goal(id=1, code="WIS-K3-1.1", title="Getallen", subject="Wiskunde", domain="RB", subdomain="Getallen", goal_type="OP_STAP")
    activity_db.add(goal)
    activity_db.commit()

    response = activity_client.post(
        "/api/activities",
        json={"name": "Rekenen", "theme_id": 1, "goal_items": [{"goal_id": 1, "observe": True}]},
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data["goals"]) == 1
    assert data["goals"][0]["label"] == "Getallen"
    assert data["goals"][0]["observe"] is True

    observation_goals = activity_db.query(ObservationGoal).filter(ObservationGoal.goal_id == 1).all()
    assert len(observation_goals) == 1
    assert observation_goals[0].name == "Getallen"


def test_create_activity_with_custom_label(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)

    goal = Goal(id=1, code="WIS-K3-1.1", title="Getallen", subject="Wiskunde", goal_type="OP_STAP")
    activity_db.add(goal)
    activity_db.commit()

    response = activity_client.post(
        "/api/activities",
        json={"name": "Rekenen", "theme_id": 1, "goal_items": [{"goal_id": 1, "label": "Mijn label", "observe": False}]},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["goals"][0]["label"] == "Mijn label"
    assert data["goals"][0]["observe"] is False

    observation_goals = activity_db.query(ObservationGoal).filter(ObservationGoal.goal_id == 1).all()
    assert len(observation_goals) == 1
    assert observation_goals[0].name == "Mijn label"


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
    create_resp = activity_client.post("/api/activities", json={"name": "Oud", "theme_id": 1})
    activity_id = create_resp.json()["id"]

    response = activity_client.put(f"/api/activities/{activity_id}", json={"name": "Nieuw", "theme_id": 1})
    assert response.status_code == 200
    assert response.json()["name"] == "Nieuw"


def test_update_activity_goals_replaces_links(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    goal1 = Goal(id=1, code="G1", title="Eerste", subject="Wiskunde", goal_type="OP_STAP")
    goal2 = Goal(id=2, code="G2", title="Tweede", subject="Wiskunde", goal_type="OP_STAP")
    goal3 = Goal(id=3, code="G3", title="Derde", subject="Wiskunde", goal_type="OP_STAP")
    activity_db.add_all([goal1, goal2, goal3])
    activity_db.commit()

    create_resp = activity_client.post(
        "/api/activities",
        json={
            "name": "Act",
            "theme_id": 1,
            "goal_items": [{"goal_id": 1, "observe": False}, {"goal_id": 2, "observe": True}],
        },
    )
    activity_id = create_resp.json()["id"]
    assert len(create_resp.json()["goals"]) == 2
    assert create_resp.json()["goals"][0]["goal_id"] == 1
    assert create_resp.json()["goals"][1]["goal_id"] == 2

    response = activity_client.put(
        f"/api/activities/{activity_id}",
        json={"goal_items": [{"goal_id": 2, "observe": False}, {"goal_id": 3, "observe": True}], "theme_id": 1},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["goals"]) == 2
    goal_ids = {g["goal_id"] for g in data["goals"]}
    assert goal_ids == {2, 3}
    assert data["goals"][0]["observe"] is not True or data["goals"][1]["observe"] is True


def test_update_activity_removes_all_goals_when_empty(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    goal = Goal(id=1, code="G1", title="Eerste", subject="Wiskunde", goal_type="OP_STAP")
    activity_db.add(goal)
    activity_db.commit()

    create_resp = activity_client.post(
        "/api/activities",
        json={"name": "Act", "theme_id": 1, "goal_items": [{"goal_id": 1, "observe": False}]},
    )
    activity_id = create_resp.json()["id"]
    assert len(create_resp.json()["goals"]) == 1

    response = activity_client.put(
        f"/api/activities/{activity_id}",
        json={"goal_items": [], "theme_id": 1},
    )
    assert response.status_code == 200
    assert response.json()["goals"] == []


def test_update_activity_goal_label(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    goal = Goal(id=1, code="G1", title=" Originele titel ", subject="Wiskunde", goal_type="OP_STAP")
    activity_db.add(goal)
    activity_db.commit()

    create_resp = activity_client.post(
        "/api/activities",
        json={"name": "Act", "theme_id": 1, "goal_items": [{"goal_id": 1, "observe": False}]},
    )
    activity_id = create_resp.json()["id"]
    assert create_resp.json()["goals"][0]["label"] == " Originele titel "

    response = activity_client.put(
        f"/api/activities/{activity_id}",
        json={"goal_items": [{"goal_id": 1, "label": "Mijn aangepaste naam", "observe": True}], "theme_id": 1},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["goals"][0]["label"] == "Mijn aangepaste naam"
    assert data["goals"][0]["observe"] is True


def test_delete_activity_success(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    create_resp = activity_client.post("/api/activities", json={"name": "Te verwijderen", "theme_id": 1})
    activity_id = create_resp.json()["id"]

    response = activity_client.delete(f"/api/activities/{activity_id}")
    assert response.status_code == 204
    assert activity_db.query(Activity).count() == 0


def test_delete_activity_observation_goal_success(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    goal = Goal(id=1, code="WIS-K3-1.1", title="Getallen", subject="Wiskunde", goal_type="OP_STAP")
    activity_db.add(goal)
    activity_db.commit()

    create_resp = activity_client.post(
        "/api/activities",
        json={"name": "Act", "theme_id": 1, "goal_items": [{"goal_id": 1, "label": None, "observe": False}]},
    )
    activity_id = create_resp.json()["id"]
    observation_goal_id = create_resp.json()["goals"][0]["id"]

    response = activity_client.delete(f"/api/activities/{activity_id}/observation-goals/{observation_goal_id}")
    assert response.status_code == 204

    detail = activity_client.get(f"/api/activities/{activity_id}").json()
    assert len(detail["goals"]) == 0


def test_available_goals_includes_observation_goals(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)

    goal = Goal(id=1, code="OP-1", title="Opstap", subject="Wiskunde", goal_type="OP_STAP")
    linked_observation_goal = ObservationGoal(
        id=1,
        school_id=1,
        created_by=1,
        name="Mijn label",
        subject="Wiskunde",
        domain="Getallen",
        subdomain="Telkunde",
        goal_id=1,
        class_id=None,
    )
    custom_observation_goal = ObservationGoal(
        id=2,
        school_id=1,
        created_by=1,
        name="Eigen doel",
        subject="Schooleigen doelen",
        domain="Welbevinden",
        subdomain=None,
        goal_id=None,
        class_id=None,
    )
    activity_db.add_all([goal, linked_observation_goal, custom_observation_goal])
    activity_db.commit()

    response = activity_client.get("/api/activities/available-goals")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    subjects = {item["subject"] for item in data}
    assert "Wiskunde" in subjects
    assert "Schooleigen doelen" in subjects


def test_available_goals_is_school_scoped(activity_client: TestClient, activity_db: Session):
    seed_school_and_theme(activity_db, 1, 1)
    school2 = School(id=2, name="School 2", slug="school-2", is_active=True)
    activity_db.add(school2)
    user1 = User(id=1, email="teacher@example.com", hashed_password="hashed", name="Teacher", is_active=True, is_superuser=False, school_id=1)
    user2 = User(id=2, email="teacher2@example.com", hashed_password="hashed", name="Teacher 2", is_active=True, is_superuser=False, school_id=2)
    activity_db.add_all([user1, user2])
    activity_db.commit()

    goal = Goal(id=1, code="OP-1", title="Opstap", subject="Wiskunde", goal_type="OP_STAP")
    og1 = ObservationGoal(
        id=1,
        school_id=1,
        created_by=1,
        name="OG1",
        subject="Wiskunde",
        domain="Getallen",
        subdomain="Telkunde",
        goal_id=1,
        class_id=None,
    )
    og2 = ObservationGoal(
        id=2,
        school_id=2,
        created_by=2,
        name="OG2",
        subject="Nederlands",
        domain="Lezen",
        subdomain="Begrijpend lezen",
        goal_id=1,
        class_id=None,
    )
    activity_db.add_all([goal, og1, og2])
    activity_db.commit()

    activity_client.app.dependency_overrides[auth_module.get_current_user] = lambda: UserResponse(
        id=1,
        email="teacher@example.com",
        name="Teacher",
        is_active=True,
        is_superuser=False,
        school_id=1,
    )

    response = activity_client.get("/api/activities/available-goals")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["subject"] == "Wiskunde"

    activity_client.app.dependency_overrides[auth_module.get_current_user] = lambda: UserResponse(
        id=2,
        email="teacher2@example.com",
        name="Teacher 2",
        is_active=True,
        is_superuser=False,
        school_id=2,
    )
    response = activity_client.get("/api/activities/available-goals")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["subject"] == "Nederlands"
