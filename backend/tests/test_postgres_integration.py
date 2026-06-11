"""
PostgreSQL integration tests.
Run with: pytest tests/test_postgres_integration.py -v
Requires: DATABASE_URL set to PostgreSQL in .env or environment
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base, engine
from app.models.user import User
from app.core.security import get_password_hash


@pytest.fixture(scope="module")
def pg_client():
    """Create a test client that uses the configured database (PostgreSQL)."""
    # Ensure tables exist in PostgreSQL
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    # Cleanup tables after tests
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def pg_seeded_admin(pg_client: TestClient):
    """Ensure admin user exists in PostgreSQL."""
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
    return pg_client


def test_postgres_login(pg_seeded_admin: TestClient):
    response = pg_seeded_admin.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "admin"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_postgres_get_me(pg_seeded_admin: TestClient):
    login_response = pg_seeded_admin.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "admin"},
    )
    token = login_response.json()["access_token"]

    response = pg_seeded_admin.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "admin@example.com"
    assert data["name"] == "Admin"
