import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base, engine


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


def test_register_demo_success(client: TestClient):
    """Test successful demo registration."""
    response = client.post(
        "/api/register/demo",
        json={"email": "demo@example.com", "name": "Demo User", "koepel": "KOOPPEL1"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "demo@example.com"
    assert data["name"] == "Demo User"
    assert data["is_demo"] is True
    assert data["is_pending"] is True
    # Demo school is not created yet - it will be created after koepel selection
    assert data["demo_school_id"] is None
    assert data["demo_expires_at"] is not None


def test_register_demo_duplicate_email(client: TestClient):
    """Test demo registration with duplicate email fails."""
    # First registration
    client.post(
        "/api/register/demo",
        json={"email": "duplicate@example.com", "name": "User 1"},
    )

    # Second registration with same email
    response = client.post(
        "/api/register/demo",
        json={"email": "duplicate@example.com", "name": "User 2"},
    )
    assert response.status_code == 400
    assert "bestaat al" in response.json()["detail"]


def test_register_regular_with_school_name(client: TestClient):
    """Test regular registration with custom school name."""
    response = client.post(
        "/api/register/regular",
        json={"email": "customschool@example.com", "name": "Custom School User", "school_name": "Mijn School"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "customschool@example.com"
    assert data["school_id"] is not None


def test_register_regular_no_school(client: TestClient):
    """Test regular registration without school fails."""
    response = client.post(
        "/api/register/regular",
        json={"email": "noschool@example.com", "name": "No School User"},
    )
    assert response.status_code == 400
    assert "school" in response.json()["detail"].lower()


def test_get_scholen(client: TestClient):
    """Test getting school list from Vlaanderen API."""
    response = client.get("/api/register/schools")
    # This may return empty list if API is unavailable, but should not error
    assert response.status_code == 200
    assert isinstance(response.json(), list)