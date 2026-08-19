import pytest
from fastapi.testclient import TestClient

import app.core.database as database_module
from app.core.database import Base, engine
from app.core.security import get_password_hash
from app.main import app
from app.models.user import User


@pytest.fixture(scope="module")
def client():
    """Create a test client with SQLite in-memory database."""
    import app.core.config as config_module
    original_url = config_module.settings.database_url
    config_module.settings.database_url = "sqlite:///:memory:"

    Base.metadata.create_all(bind=engine)
    database_module._initialized = True

    with TestClient(app) as c:
        yield c

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
    from app.models.school_year import Class, SchoolYear, Student

    unique_email = f"demo_{uuid.uuid4().hex[:8]}@example.com"
    
    db = SessionLocal()
    try:
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

        demo_school = School(
            name="Demo School",
            slug=f"demo-school-{uuid.uuid4().hex[:8]}",
            is_active=True,
            is_demo=True,
        )
        db.add(demo_school)
        db.commit()
        db.refresh(demo_school)

        user.demo_school_id = demo_school.id
        db.commit()

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

    login_response = client.post(
        "/api/auth/login",
        json={"email": unique_email, "password": "password"},
    )
    token = login_response.json()["access_token"]

    response = client.post(
        "/api/auth/reset-demo",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    db = SessionLocal()
    try:
        updated_user = db.query(User).filter(User.email == unique_email).first()
        assert updated_user.demo_school_id is None
    finally:
        db.close()


def test_select_koepel_with_school_for_regular_user(client: TestClient):
    """Test that regular user selecting koepel with a school creates a pending request."""
    import uuid

    from app.core.database import SessionLocal
    from app.models.school import School
    from app.models.koepel import Koepel

    unique_email = f"teacher_{uuid.uuid4().hex[:8]}@example.com"
    
    db = SessionLocal()
    try:
        user = User(
            email=unique_email,
            hashed_password=get_password_hash("password"),
            name="Teacher",
            is_active=True,
            is_demo=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        school = School(
            name="Selectie School",
            slug=f"selectie-school-{uuid.uuid4().hex[:8]}",
            is_active=True,
        )
        db.add(school)
        db.commit()
        db.refresh(school)
        school_id = school.id

        koepel = Koepel(
            name="Test Koepel",
            slug="test-koepel",
            is_active=True,
        )
        db.add(koepel)
        db.commit()
        db.refresh(koepel)
    finally:
        db.close()

    login_response = client.post(
        "/api/auth/login",
        json={"email": unique_email, "password": "password"},
    )
    token = login_response.json()["access_token"]

    response = client.post(
        "/api/auth/select-koepel",
        headers={"Authorization": f"Bearer {token}"},
        json={"koepel": "test-koepel", "school_id": school_id},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["membership_pending"] is True
    assert data["pending_koepel"] == "test-koepel"
    assert data["school_id"] is None

    db = SessionLocal()
    try:
        updated_school = db.query(School).filter(School.id == school_id).first()
        assert updated_school.koepel is None
        updated_user = db.query(User).filter(User.email == unique_email).first()
        assert updated_user.membership_pending is True
        assert updated_user.school_id is None
    finally:
        db.close()


def test_pending_membership_approval_flow(client: TestClient):
    """Test the full pending membership approval flow."""
    import uuid

    from app.core.database import SessionLocal
    from app.models.school import School
    from app.models.koepel import Koepel

    # Create superuser and school
    db = SessionLocal()
    try:
        admin = User(
            email="admin-flow@example.com",
            hashed_password=get_password_hash("admin"),
            name="Admin Flow",
            is_superuser=True,
            is_active=True,
        )
        db.add(admin)

        school = School(
            name="Flow School",
            slug=f"flow-school-{uuid.uuid4().hex[:8]}",
            is_active=True,
        )
        db.add(school)
        db.commit()
        db.refresh(school)
        school_id = school.id

        koepel = Koepel(
            name="Flow Koepel",
            slug="flow-koepel",
            is_active=True,
        )
        db.add(koepel)
        db.commit()
        db.refresh(koepel)
    finally:
        db.close()

    # Helper to create a regular user
    def create_user(email, password):
        db = SessionLocal()
        try:
            user = User(
                email=email,
                hashed_password=get_password_hash(password),
                name=email.split("@")[0].capitalize(),
                is_active=True,
                is_demo=False,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user.id
        finally:
            db.close()

    # Helper to login and return token
    def login(email, password):
        resp = client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        assert resp.status_code == 200
        return resp.json()["access_token"]

    # Helper to request access to school
    def request_access(token, school_id):
        resp = client.post(
            "/api/auth/select-koepel",
            headers={"Authorization": f"Bearer {token}"},
            json={"koepel": "flow-koepel", "school_id": school_id},
        )
        return resp

    # Helper to get pending members
    def get_pending(token, school_id):
        resp = client.get(
            f"/api/auth/schools/{school_id}/pending-members",
            headers={"Authorization": f"Bearer {token}"},
        )
        return resp

    # Helper to approve member
    def approve_member(token, school_id, user_id):
        resp = client.post(
            f"/api/auth/schools/{school_id}/pending-members/{user_id}/approve",
            headers={"Authorization": f"Bearer {token}"},
        )
        return resp

    # Helper to reject member
    def reject_member(token, school_id, user_id):
        resp = client.post(
            f"/api/auth/schools/{school_id}/pending-members/{user_id}/reject",
            headers={"Authorization": f"Bearer {token}"},
        )
        return resp

    # Step 1: Create user1, login, request access
    user1_id = create_user("user1@example.com", "user1")
    token1 = login("user1@example.com", "user1")
    resp = request_access(token1, school_id)
    assert resp.status_code == 200
    assert resp.json()["membership_pending"] is True
    assert resp.json()["pending_school_id"] == school_id

    # Step 2: Login as superuser, approve user1
    admin_token = login("admin-flow@example.com", "admin")
    resp = get_pending(admin_token, school_id)
    assert resp.status_code == 200
    pending = resp.json()
    assert len(pending) == 1
    assert pending[0]["email"] == "user1@example.com"

    resp = approve_member(admin_token, school_id, user1_id)
    assert resp.status_code == 200
    assert resp.json()["membership_pending"] is False
    assert resp.json()["school_id"] == school_id

    # Step 3: Create user2, login, request access
    user2_id = create_user("user2@example.com", "user2")
    token2 = login("user2@example.com", "user2")
    resp = request_access(token2, school_id)
    assert resp.status_code == 200
    assert resp.json()["membership_pending"] is True

    # Step 4: Create user3, login, request access
    user3_id = create_user("user3@example.com", "user3")
    token3 = login("user3@example.com", "user3")
    resp = request_access(token3, school_id)
    assert resp.status_code == 200
    assert resp.json()["membership_pending"] is True

    # Step 5: Login as user1, approve user2, reject user3
    token1 = login("user1@example.com", "user1")
    resp = get_pending(token1, school_id)
    assert resp.status_code == 200
    pending = resp.json()
    assert len(pending) == 2

    resp = approve_member(token1, school_id, user2_id)
    assert resp.status_code == 200
    assert resp.json()["membership_pending"] is False
    assert resp.json()["school_id"] == school_id

    resp = reject_member(token1, school_id, user3_id)
    assert resp.status_code == 200
    assert resp.json()["membership_pending"] is False
    assert resp.json()["school_id"] is None

    # Step 6: Login as user2, verify access
    token2 = login("user2@example.com", "user2")
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert resp.status_code == 200
    assert resp.json()["school_id"] == school_id
    assert resp.json()["membership_pending"] is False

    # Step 7: Login as user3, verify NO access
    token3 = login("user3@example.com", "user3")
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token3}"},
    )
    assert resp.status_code == 200
    assert resp.json()["school_id"] is None
    assert resp.json()["membership_pending"] is False

    # Verify pending list is empty after actions
    resp = get_pending(admin_token, school_id)
    assert resp.status_code == 200
    assert resp.json() == []
