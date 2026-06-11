import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base, engine
from app.models.user import User
from app.core.security import get_password_hash


@pytest.fixture(scope="module")
def client():
    """Create a test client with SQLite in-memory database."""
    # Override database URL for testing
    import app.core.config as config_module
    original_url = config_module.settings.database_url
    config_module.settings.database_url = "sqlite:///:memory:"

    # Create tables
    Base.metadata.create_all(bind=engine)

    with TestClient(app) as c:
        yield c

    # Cleanup
    Base.metadata.drop_all(bind=engine)
    config_module.settings.database_url = original_url


@pytest.fixture
def seeded_admin(client: TestClient):
    """Seed the admin user for testing."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "admin@example.com").first()
        if not existing:
            admin = User(
                email="admin@example.com",
                hashed_password=get_password_hash("admin"),
                name="Admin",
                is_active=True,
                is_superuser=True,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()
    return client


def test_login_success(seeded_admin: TestClient):
    response = seeded_admin.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "admin"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(seeded_admin: TestClient):
    response = seeded_admin.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401


def test_login_user_not_found(seeded_admin: TestClient):
    response = seeded_admin.post(
        "/api/auth/login",
        json={"email": "nonexistent@example.com", "password": "any"},
    )
    assert response.status_code == 401


def test_get_me_success(seeded_admin: TestClient):
    # First login to get token
    login_response = seeded_admin.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "admin"},
    )
    token = login_response.json()["access_token"]

    # Use token to get current user
    response = seeded_admin.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "admin@example.com"
    assert data["name"] == "Admin"


def test_get_me_invalid_token(seeded_admin: TestClient):
    response = seeded_admin.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert response.status_code == 401


def test_get_me_no_token(seeded_admin: TestClient):
    response = seeded_admin.get("/api/auth/me")
    assert response.status_code == 401
