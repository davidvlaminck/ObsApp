import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import auth as auth_module
from app.api import schools as schools_router_module
from app.api import users as users_router_module
from app.core.database import Base
from app.core.security import verify_password
from app.models.school import School
from app.models.user import User
from app.schemas.user import UserResponse

schools_router = schools_router_module.router
users_router = users_router_module.router

SUPERUSER_RESPONSE = UserResponse(
    id=1,
    email="admin@example.com",
    name="Admin",
    is_active=True,
    is_superuser=True,
    is_pending=False,
    school_id=1,
)


@pytest.fixture
def management_db() -> Session:
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
def management_client(management_db: Session):
    """Create a test client for school and user management routers."""
    test_app = FastAPI()
    test_app.include_router(schools_router, prefix="/api")
    test_app.include_router(users_router, prefix="/api")

    def override_get_db():
        try:
            yield management_db
        finally:
            pass

    original_get_db = schools_router_module.get_db
    test_app.dependency_overrides[original_get_db] = override_get_db
    test_app.dependency_overrides[auth_module.get_current_user] = lambda: SUPERUSER_RESPONSE

    with TestClient(test_app) as client:
        yield client


def test_create_school_endpoint_creates_school(management_client: TestClient, management_db: Session):
    response = management_client.post("/api/schools", json={"name": "Basisschool De Vlinder"})

    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["name"] == "Basisschool De Vlinder"
    assert data["slug"] == "basisschool-de-vlinder"
    assert data["is_active"] is True
    assert data["created_at"] is not None
    assert management_db.query(School).count() == 1


def test_create_school_endpoint_rejects_duplicate_slug(management_client: TestClient):
    first_response = management_client.post("/api/schools", json={"name": "Demo School"})
    assert first_response.status_code == 201

    duplicate_response = management_client.post(
        "/api/schools",
        json={"name": "Another School", "slug": first_response.json()["slug"]},
    )

    assert duplicate_response.status_code == 400
    assert duplicate_response.json()["detail"] == "Deze slug bestaat al"


def test_create_school_endpoint_requires_superuser(management_client: TestClient):
    teacher_response = UserResponse(
        id=2,
        email="teacher@example.com",
        name="Teacher",
        is_active=True,
        is_superuser=False,
        is_pending=False,
        school_id=1,
    )
    management_client.app.dependency_overrides[auth_module.get_current_user] = lambda: teacher_response

    response = management_client.post("/api/schools", json={"name": "Demo School"})

    assert response.status_code == 403
    assert response.json()["detail"] == "Niet bevoegd"


def test_create_user_endpoint_requires_superuser(management_client: TestClient):
    teacher_response = UserResponse(
        id=2,
        email="teacher@example.com",
        name="Teacher",
        is_active=True,
        is_superuser=False,
        is_pending=False,
        school_id=1,
    )
    management_client.app.dependency_overrides[auth_module.get_current_user] = lambda: teacher_response

    response = management_client.post(
        "/api/users",
        json={
            "email": "teacher@example.com",
            "password": "secret123",
            "name": "Teacher",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Niet bevoegd"


def test_create_user_endpoint_creates_user_for_school(
    management_client: TestClient,
    management_db: Session,
):
    school_response = management_client.post("/api/schools", json={"name": "Demo School"})
    assert school_response.status_code == 201
    school_id = school_response.json()["id"]

    response = management_client.post(
        "/api/users",
        json={
            "email": "teacher@example.com",
            "password": "secret123",
            "name": "Teacher",
            "school_id": school_id,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["email"] == "teacher@example.com"
    assert data["name"] == "Teacher"
    assert data["school_id"] == school_id
    assert data["is_active"] is True
    assert data["is_superuser"] is False
    assert data["is_pending"] is False
    assert "password" not in data

    user = management_db.query(User).filter(User.email == "teacher@example.com").one()
    assert user.school_id == school_id
    assert verify_password("secret123", user.hashed_password)


def test_create_user_endpoint_sends_activation_email_when_password_omitted(
    management_client: TestClient,
    management_db: Session,
    monkeypatch: pytest.MonkeyPatch,
):
    school_response = management_client.post("/api/schools", json={"name": "Demo School"})
    assert school_response.status_code == 201
    school_id = school_response.json()["id"]
    sent_emails = []

    def fake_send_activation_email(to_email: str, activation_link: str):
        sent_emails.append((to_email, activation_link))

    monkeypatch.setattr(users_router_module, "send_activation_email", fake_send_activation_email)

    response = management_client.post(
        "/api/users",
        json={
            "email": "invited@example.com",
            "name": "Invited Teacher",
            "school_id": school_id,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["is_pending"] is True
    assert data["is_active"] is True
    assert management_db.query(User).filter(User.email == "invited@example.com").one().is_pending
    assert sent_emails == [(data["email"], sent_emails[0][1])]
    assert "/set-password?token=" in sent_emails[0][1]


def test_create_user_endpoint_rejects_duplicate_email(management_client: TestClient):
    school_response = management_client.post("/api/schools", json={"name": "Demo School"})
    assert school_response.status_code == 201
    school_id = school_response.json()["id"]

    payload = {
        "email": "teacher@example.com",
        "password": "secret123",
        "name": "Teacher",
        "school_id": school_id,
    }
    first_response = management_client.post("/api/users", json=payload)
    duplicate_response = management_client.post("/api/users", json=payload)

    assert first_response.status_code == 201
    assert duplicate_response.status_code == 400
    assert duplicate_response.json()["detail"] == "Dit e-mailadres bestaat al"


def test_create_user_endpoint_rejects_unknown_school(management_client: TestClient):
    response = management_client.post(
        "/api/users",
        json={
            "email": "teacher@example.com",
            "password": "secret123",
            "name": "Teacher",
            "school_id": 999,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "School niet gevonden"


def test_create_user_endpoint_validates_email(management_client: TestClient):
    response = management_client.post(
        "/api/users",
        json={
            "email": "not-an-email",
            "password": "secret123",
            "name": "Teacher",
            "school_id": 1,
        },
    )

    assert response.status_code == 422
