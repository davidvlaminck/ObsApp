import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import date

from app.api import auth as auth_module
from app.api import observation_goals as observation_goals_router_module
from app.core.database import Base
from app.models.goal import Goal
from app.models.observation_goal import ObservationGoal
from app.models.school import School
from app.models.school_year import SchoolYear, Class as ClassModel
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
def observation_goal_db() -> Session:
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
def observation_goal_client(observation_goal_db: Session):
    test_app = FastAPI()
    test_app.include_router(observation_goals_router_module.router, prefix="/api")

    def override_get_db():
        try:
            yield observation_goal_db
        finally:
            pass

    test_app.dependency_overrides[observation_goals_router_module.get_db] = override_get_db
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


def seed_opstap_goal(db: Session, goal_id: int = 1):
    db.add(
        Goal(
            id=goal_id,
            code="WIS-K-1.1.1",
            title="Getallen vergelijken",
            description="De leerling vergelijkt aantallen tot 10.",
            subject="Wiskunde",
            level="K-",
            domain="Getallen en bewerkingen",
            subdomain="Getallen",
            cluster="Vergelijken",
            goal_type="OP_STAP",
            doel_soort="P",
            vo_code="1.1.1",
        )
    )
    db.commit()


def test_create_observation_goal_links_opstap_goal(
    observation_goal_client: TestClient,
    observation_goal_db: Session,
):
    seed_school_and_user(observation_goal_db, 1, 1, "teacher@example.com")
    seed_opstap_goal(observation_goal_db)

    response = observation_goal_client.post(
        "/api/observation-goals",
        json={
            "name": "Lezen",
            "subject": "Wiskunde",
            "domain": "Getallen en bewerkingen",
            "subdomain": "Getallen",
            "goal_id": 1,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["school_id"] == 1
    assert data["created_by"] == 1
    assert data["name"] == "Lezen"
    assert data["subject"] == "Wiskunde"
    assert data["domain"] == "Getallen en bewerkingen"
    assert data["subdomain"] == "Getallen"
    assert data["goal_id"] == 1
    assert data["goal"]["code"] == "WIS-K-1.1.1"
    assert data["goal"]["domain"] == "Getallen en bewerkingen"
    assert data["goal"]["subdomain"] == "Getallen"
    assert data["goal"]["cluster"] == "Vergelijken"
    assert observation_goal_db.query(ObservationGoal).count() == 1


def test_list_observation_goals_filters_and_is_school_scoped(
    observation_goal_client: TestClient,
    observation_goal_db: Session,
):
    seed_school_and_user(observation_goal_db, 1, 1, "teacher@example.com")
    seed_school_and_user(observation_goal_db, 2, 2, "teacher2@example.com")
    observation_goal_client.app.dependency_overrides[auth_module.get_current_user] = lambda: UserResponse(
        id=1,
        email="teacher@example.com",
        name="Teacher",
        is_active=True,
        is_superuser=False,
        school_id=1,
    )

    observation_goal_client.post(
        "/api/observation-goals",
        json={"name": "Lezen", "subject": "Wiskunde", "domain": "Getallen en bewerkingen", "subdomain": "K-", "goal_id": None},
    )
    observation_goal_client.post(
        "/api/observation-goals",
        json={"name": "Schrijven", "subject": "Nederlands", "domain": "Taalbeschouwing", "subdomain": "K2", "goal_id": None},
    )

    observation_goal_client.app.dependency_overrides[auth_module.get_current_user] = lambda: UserResponse(
        id=2,
        email="teacher2@example.com",
        name="Teacher 2",
        is_active=True,
        is_superuser=False,
        school_id=2,
    )
    observation_goal_client.post(
        "/api/observation-goals",
        json={"name": "Andere school", "subject": "Wiskunde", "subdomain": "K-", "goal_id": None},
    )

    observation_goal_client.app.dependency_overrides[auth_module.get_current_user] = lambda: UserResponse(
        id=1,
        email="teacher@example.com",
        name="Teacher",
        is_active=True,
        is_superuser=False,
        school_id=1,
    )

    response = observation_goal_client.get(
        "/api/observation-goals",
        params={"subject": "Wiskunde", "domain": "Getallen en bewerkingen", "q": "Le"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == 1
    assert data[0]["name"] == "Lezen"
    assert data[0]["subject"] == "Wiskunde"
    assert data[0]["domain"] == "Getallen en bewerkingen"
    assert data[0]["subdomain"] == "K-"
    assert data[0]["goal_id"] is None
    assert data[0]["goal"] is None
    assert data[0]["updated_at"] is None


def test_search_opstap_goals_requires_two_characters_for_text_filter(
    observation_goal_client: TestClient,
    observation_goal_db: Session,
):
    seed_school_and_user(observation_goal_db, 1, 1, "teacher@example.com")
    seed_opstap_goal(observation_goal_db)
    observation_goal_db.add(
        Goal(
            id=2,
            code="NED-K-2.1.1",
            title="Korte zinnen lezen",
            description="De leerling leest korte zinnen.",
            subject="Nederlands",
            level="K-",
            goal_type="OP_STAP",
        )
    )
    observation_goal_db.commit()

    response = observation_goal_client.get("/api/observation-goals/goals/search", params={"q": "zinnen"})

    assert response.status_code == 200
    assert [goal["code"] for goal in response.json()] == ["NED-K-2.1.1"]


def test_subject_and_subdomain_lists_include_available_opstap_goals(
    observation_goal_client: TestClient,
    observation_goal_db: Session,
):
    seed_school_and_user(observation_goal_db, 1, 1, "teacher@example.com")
    seed_opstap_goal(observation_goal_db)

    subjects_response = observation_goal_client.get("/api/observation-goals/subjects")
    domains_response = observation_goal_client.get("/api/observation-goals/domains", params={"subject": "Wiskunde"})
    subdomains_response = observation_goal_client.get(
        "/api/observation-goals/subdomains",
        params={"subject": "Wiskunde", "domain": "Getallen en bewerkingen"},
    )

    assert subjects_response.status_code == 200
    assert subjects_response.json() == ["Wiskunde"]
    assert domains_response.status_code == 200
    assert domains_response.json() == ["Getallen en bewerkingen"]
    assert subdomains_response.status_code == 200
    assert subdomains_response.json() == ["Getallen"]


def test_create_observation_goal_rejects_unknown_goal(
    observation_goal_client: TestClient,
    observation_goal_db: Session,
):
    seed_school_and_user(observation_goal_db, 1, 1, "teacher@example.com")

    response = observation_goal_client.post(
        "/api/observation-goals",
        json={"name": "Lezen", "subject": "Wiskunde", "domain": "Getallen en bewerkingen", "subdomain": "K-", "goal_id": 999},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Op Stap doel niet gevonden"
    assert observation_goal_db.query(ObservationGoal).count() == 0


def test_delete_observation_goal_endpoint_deletes_current_school_goal(
    observation_goal_client: TestClient,
    observation_goal_db: Session,
):
    seed_school_and_user(observation_goal_db, 1, 1, "teacher@example.com")
    observation_goal_client.post(
        "/api/observation-goals",
        json={"name": "Lezen", "subject": "Wiskunde", "domain": "Getallen en bewerkingen", "subdomain": "K-", "goal_id": None},
    )

    response = observation_goal_client.delete("/api/observation-goals/1")

    assert response.status_code == 204
    assert observation_goal_db.query(ObservationGoal).count() == 0


def test_list_classes_returns_all_school_classes(
    observation_goal_client: TestClient,
    observation_goal_db: Session,
):
    from app.models.school_year import SchoolYear, Class as ClassModel

    seed_school_and_user(observation_goal_db, 1, 1, "teacher@example.com")
    school_year = SchoolYear(school_id=1, name="2026-2027", start_date=date(2026, 9, 1), end_date=date(2027, 6, 30), is_active=True)
    observation_goal_db.add(school_year)
    observation_goal_db.commit()
    observation_goal_db.refresh(school_year)

    cls1 = ClassModel(school_year_id=school_year.id, name="3K", class_type="K3")
    cls2 = ClassModel(school_year_id=school_year.id, name="2K", class_type="K2")
    observation_goal_db.add_all([cls1, cls2])
    observation_goal_db.commit()

    response = observation_goal_client.get("/api/observation-goals/classes")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    names = {c["name"] for c in data}
    assert names == {"3K", "2K"}


def test_search_opstap_goals_filters_by_level(
    observation_goal_client: TestClient,
    observation_goal_db: Session,
):
    seed_school_and_user(observation_goal_db, 1, 1, "teacher@example.com")
    observation_goal_db.add_all([
        Goal(
            id=10,
            code="WIS-K3-1.1",
            title="K3 doel",
            subject="Wiskunde",
            level="K3",
            goal_type="OP_STAP",
        ),
        Goal(
            id=11,
            code="WIS-K2-1.1",
            title="K2 doel",
            subject="Wiskunde",
            level="K2",
            goal_type="OP_STAP",
        ),
        Goal(
            id=12,
            code="NED-JK-1.1",
            title="JK doel",
            subject="Nederlands",
            level="JK",
            goal_type="OP_STAP",
        ),
    ])
    observation_goal_db.commit()

    response = observation_goal_client.get("/api/observation-goals/goals/search", params={"level": "K3"})

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["code"] == "WIS-K3-1.1"
    assert data[0]["level"] == "K3"


def test_demo_user_cannot_create_more_than_20_goals(
    observation_goal_client: TestClient,
    observation_goal_db: Session,
):
    seed_school_and_user(observation_goal_db, 1, 1, "teacher@example.com")
    seed_opstap_goal(observation_goal_db)

    demo_user_response = UserResponse(
        id=1,
        email="teacher@example.com",
        name="Teacher",
        is_active=True,
        is_superuser=False,
        school_id=1,
        is_demo=True,
    )
    observation_goal_client.app.dependency_overrides[auth_module.get_current_user] = lambda: demo_user_response

    # Create 20 goals (10 predefined + 10 custom)
    for i in range(20):
        response = observation_goal_client.post(
            "/api/observation-goals",
            json={
                "name": f"Doel {i}",
                "subject": "Wiskunde",
                "domain": "Getallen en bewerkingen",
                "subdomain": "Getallen",
                "goal_id": 1,
            },
        )
        assert response.status_code == 201, f"Failed at goal {i}: {response.text}"

    # 21st goal should be rejected
    response = observation_goal_client.post(
        "/api/observation-goals",
        json={
            "name": "Doel 21",
            "subject": "Wiskunde",
            "domain": "Getallen en bewerkingen",
            "subdomain": "Getallen",
            "goal_id": 1,
        },
    )
    assert response.status_code == 403
    assert "Als demo gebruiker kan je tot 10 doelen zelf aanmaken" in response.json()["detail"]
