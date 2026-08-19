import pytest
from fastapi.testclient import TestClient

import app.core.database as database_module
from app.core.database import Base, engine
from app.main import app


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


def test_register_demo_success(client: TestClient):
    """Test successful demo registration."""
    import uuid

    unique_email = f"demo_{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/register/demo",
        json={"email": unique_email, "name": "Demo User"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == unique_email
    assert data["name"] == "Demo User"
    assert data["is_demo"] is True
    assert data["is_pending"] is True
    assert data["demo_school_id"] is None
    assert data["demo_expires_at"] is not None


def test_register_demo_duplicate_email(client: TestClient):
    """Test demo registration with duplicate email fails."""
    client.post(
        "/api/register/demo",
        json={"email": "duplicate@example.com", "name": "User 1"},
    )

    response = client.post(
        "/api/register/demo",
        json={"email": "duplicate@example.com", "name": "User 2"},
    )
    assert response.status_code == 400
    assert "bestaat al" in response.json()["detail"]


def test_register_regular_without_school(client: TestClient):
    """Test regular registration without school succeeds (school selected during onboarding)."""
    response = client.post(
        "/api/register/regular",
        json={"email": "noschool@example.com", "name": "No School User"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "noschool@example.com"
    assert data["school_id"] is None


def test_register_regular_with_school_name(client: TestClient):
    """Test regular registration with custom school name still works."""
    response = client.post(
        "/api/register/regular",
        json={"email": "customschool@example.com", "name": "Custom School User", "school_name": "Mijn School"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "customschool@example.com"
    assert data["school_id"] is not None


def test_get_scholen(client: TestClient):
    """Test getting school list from Vlaanderen API."""
    response = client.get("/api/register/schools")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_search_schools_requires_min_chars(client: TestClient):
    """Test that search requires at least 2 characters."""
    response = client.get("/api/register/search-schools?q=a")
    assert response.status_code == 200
    assert response.json() == []


def test_search_schools_empty_query(client: TestClient):
    """Test that empty query returns empty results."""
    response = client.get("/api/register/search-schools")
    assert response.status_code == 200
    assert response.json() == []


def test_search_schools_matches(client: TestClient):
    """Test that school search returns matching schools."""
    import uuid
    from app.core.database import SessionLocal
    from app.models.school import School

    db = SessionLocal()
    try:
        school = School(
            name="Test School Alpha",
            slug=f"test-school-{uuid.uuid4().hex[:8]}",
            is_active=True,
            address="Teststraat 1",
            postal_code="1000",
            city="Brussel",
        )
        db.add(school)
        db.commit()
        db.refresh(school)
        school_id = school.id
    finally:
        db.close()

    response = client.get("/api/register/search-schools?q=Alpha")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == school_id
    assert results[0]["name"] == "Test School Alpha"

    response = client.get("/api/register/search-schools?q=Teststraat")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == school_id