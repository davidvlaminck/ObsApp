import pytest
from sqlalchemy.orm import Session

from app.services.auth_service import AuthService
from app.models.user import User
from app.core.security import get_password_hash


@pytest.fixture
def auth_service(sqlite_db: Session):
    return AuthService(sqlite_db)


@pytest.fixture
def seeded_user(sqlite_db: Session, request):
    """Create a unique user in the test database per test."""
    import uuid
    unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    user = User(
        email=unique_email,
        hashed_password=get_password_hash("testpass123"),
        name="Test User",
        is_active=True,
        is_superuser=False,
    )
    sqlite_db.add(user)
    sqlite_db.commit()
    sqlite_db.refresh(user)
    return user


def test_authenticate_user_success(auth_service: AuthService, seeded_user: User):
    result = auth_service.authenticate_user(seeded_user.email, "testpass123")
    assert result is not None
    assert result.email == seeded_user.email
    assert result.name == "Test User"


def test_authenticate_user_wrong_password(auth_service: AuthService, seeded_user: User):
    result = auth_service.authenticate_user(seeded_user.email, "wrongpassword")
    assert result is None


def test_authenticate_user_not_found(auth_service: AuthService):
    result = auth_service.authenticate_user("nonexistent@example.com", "any")
    assert result is None


def test_authenticate_user_inactive(auth_service: AuthService, sqlite_db: Session):
    inactive_user = User(
        email="inactive@example.com",
        hashed_password=get_password_hash("pass123"),
        name="Inactive User",
        is_active=False,
        is_superuser=False,
    )
    sqlite_db.add(inactive_user)
    sqlite_db.commit()
    result = auth_service.authenticate_user("inactive@example.com", "pass123")
    assert result is None


def test_get_user_from_token_success(auth_service: AuthService, seeded_user: User):
    from app.core.security import create_access_token
    token = create_access_token(data={"sub": seeded_user.email})
    result = auth_service.get_user_from_token(token)
    assert result is not None
    assert result.email == seeded_user.email


def test_get_user_from_token_invalid(auth_service: AuthService):
    result = auth_service.get_user_from_token("invalid.token.here")
    assert result is None


def test_get_user_from_token_no_sub(auth_service: AuthService):
    from app.core.security import create_access_token
    token = create_access_token(data={"role": "admin"})
    result = auth_service.get_user_from_token(token)
    assert result is None


def test_create_user(auth_service: AuthService, sqlite_db: Session):
    user = auth_service.create_user("new@example.com", "newpass123", "New User")
    assert user.email == "new@example.com"
    assert user.name == "New User"
    assert user.is_superuser is False
    assert user.id is not None
