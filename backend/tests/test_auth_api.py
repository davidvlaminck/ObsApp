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


def test_reset_demo_forbidden_for_non_demo(client: TestClient):
    """Test that reset-demo returns 403 for non-demo users."""
    import uuid
    from app.core.database import SessionLocal
    unique_email = f"teacher_{uuid.uuid4().hex[:8]}@example.com"
    
    db = SessionLocal()
    try:
        # Create a non-demo user
        user = User(
            email=unique_email,
            hashed_password=get_password_hash("password"),
            name="Teacher",
            is_active=True,
            is_demo=False,
        )
        db.add(user)
        db.commit()
    finally:
        db.close()

    # Login to get token
    login_response = client.post(
        "/api/auth/login",
        json={"email": unique_email, "password": "password"},
    )
    token = login_response.json()["access_token"]

    # Try to reset demo - should be forbidden
    response = client.post(
        "/api/auth/reset-demo",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_reset_demo_success(client: TestClient):
    """Test that reset-demo successfully clears demo data for demo users."""
    import uuid
    from datetime import date
    from app.core.database import SessionLocal
    from app.models.school import School
    from app.models.school_year import SchoolYear, Class, Student

    unique_email = f"demo_{uuid.uuid4().hex[:8]}@example.com"
    
    db = SessionLocal()
    try:
        # Create a demo user
        user = User(
            email=unique_email,
            hashed_password=get_password_hash("password"),
            name="Demo User",
            is_active=True,
            is_demo=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Create a demo school
        demo_school = School(
            name="Demo School",
            slug=f"demo-school-{uuid.uuid4().hex[:8]}",
            is_active=True,
            is_demo=True,
        )
        db.add(demo_school)
        db.commit()
        db.refresh(demo_school)

        # Link user to demo school
        user.demo_school_id = demo_school.id
        db.commit()

        # Create school year, class, and student
        school_year = SchoolYear(
            school_id=demo_school.id,
            name="2026-2027",
            start_date=date(2026, 9, 1),
            end_date=date(2027, 6, 30),
            is_active=True,
        )
        db.add(school_year)
        db.commit()
        db.refresh(school_year)

        class_model = Class(
            school_year_id=school_year.id,
            name="3K",
            class_type="K3",
        )
        db.add(class_model)
        db.commit()
        db.refresh(class_model)

        student = Student(class_id=class_model.id, name="Test Student")
        db.add(student)
        db.commit()

    finally:
        db.close()

    # Login to get token
    login_response = client.post(
        "/api/auth/login",
        json={"email": unique_email, "password": "password"},
    )
    token = login_response.json()["access_token"]

    # Reset demo
    response = client.post(
        "/api/auth/reset-demo",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    # Verify user's demo_school_id is cleared
    db = SessionLocal()
    try:
        updated_user = db.query(User).filter(User.email == unique_email).first()
        assert updated_user.demo_school_id is None
    finally:
        db.close()
