from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import auth as auth_module
from app.api import user_settings as user_settings_router
from app.core.database import Base
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserResponse

TEACHER = UserResponse(
    id=1,
    email="teacher@example.com",
    name="Teacher",
    is_active=True,
    is_superuser=False,
    color_theme="teal",
)


def _setup(db: Session) -> TestClient:
    test_app = FastAPI()
    test_app.include_router(user_settings_router.router, prefix="/api")

    def override_get_db():
        try:
            yield db
        finally:
            pass

    test_app.dependency_overrides[user_settings_router.get_db] = override_get_db
    test_app.dependency_overrides[auth_module.get_current_user] = lambda: TEACHER
    return TestClient(test_app)


def _make_db() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return TestingSessionLocal()


def _seed_user(db: Session, color_theme: str = "teal") -> User:
    user = User(
        email="teacher@example.com",
        hashed_password=get_password_hash("password"),
        name="Teacher",
        is_active=True,
        is_superuser=False,
        color_theme=color_theme,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_get_settings_success():
    db = _make_db()
    try:
        _seed_user(db, color_theme="teal")
        with _setup(db) as client:
            response = client.get("/api/user-settings")
            assert response.status_code == 200
            assert response.json()["color_theme"] == "teal"
    finally:
        db.close()
        Base.metadata.drop_all(bind=db.bind)
        db.bind.dispose()


def test_get_settings_user_not_found():
    db = _make_db()
    try:
        with _setup(db) as client:
            response = client.get("/api/user-settings")
            assert response.status_code == 404
    finally:
        db.close()
        Base.metadata.drop_all(bind=db.bind)
        db.bind.dispose()


def test_update_settings_success():
    db = _make_db()
    try:
        user = _seed_user(db, color_theme="teal")
        with _setup(db) as client:
            response = client.put("/api/user-settings", json={"color_theme": "ocean"})
            assert response.status_code == 200
            assert response.json()["color_theme"] == "ocean"

        updated_user = db.query(User).filter(User.id == user.id).first()
        assert updated_user.color_theme == "ocean"
    finally:
        db.close()
        Base.metadata.drop_all(bind=db.bind)
        db.bind.dispose()


def test_update_settings_invalid_theme():
    db = _make_db()
    try:
        _seed_user(db, color_theme="teal")
        with _setup(db) as client:
            response = client.put("/api/user-settings", json={"color_theme": "neon-pink"})
            assert response.status_code == 400
            assert "neon-pink" not in response.json()["detail"]
    finally:
        db.close()
        Base.metadata.drop_all(bind=db.bind)
        db.bind.dispose()


def test_update_settings_default_when_none():
    db = _make_db()
    try:
        _seed_user(db, color_theme="purple")
        with _setup(db) as client:
            response = client.put("/api/user-settings", json={"color_theme": None})
            assert response.status_code == 200
            assert response.json()["color_theme"] == "teal"
    finally:
        db.close()
        Base.metadata.drop_all(bind=db.bind)
        db.bind.dispose()


def test_get_settings_returns_status_colors():
    db = _make_db()
    try:
        _seed_user(db, color_theme="teal")
        with _setup(db) as client:
            response = client.get("/api/user-settings")
            assert response.status_code == 200
            assert response.json()["status_colors"] is None
    finally:
        db.close()
        Base.metadata.drop_all(bind=db.bind)
        db.bind.dispose()


def test_update_status_colors_success():
    db = _make_db()
    try:
        _seed_user(db, color_theme="teal")
        with _setup(db) as client:
            response = client.put(
                "/api/user-settings",
                json={"status_colors": {"onvoldoende": "#ff0000", "voldoende": "#00ff00"}},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status_colors"]["onvoldoende"] == "#ff0000"
            assert data["status_colors"]["voldoende"] == "#00ff00"
            assert data["status_colors"]["in_ontwikkeling"] == "#ff9800"
    finally:
        db.close()
        Base.metadata.drop_all(bind=db.bind)
        db.bind.dispose()


def test_update_status_colors_invalid_hex():
    db = _make_db()
    try:
        _seed_user(db, color_theme="teal")
        with _setup(db) as client:
            response = client.put(
                "/api/user-settings",
                json={"status_colors": {"onvoldoende": "not-a-hex"}},
            )
            assert response.status_code == 400
            assert "not-a-hex" in response.json()["detail"]
    finally:
        db.close()
        Base.metadata.drop_all(bind=db.bind)
        db.bind.dispose()


def test_update_status_colors_invalid_key():
    db = _make_db()
    try:
        _seed_user(db, color_theme="teal")
        with _setup(db) as client:
            response = client.put(
                "/api/user-settings",
                json={"status_colors": {"invalid_status": "#ff0000"}},
            )
            assert response.status_code == 400
            assert "invalid_status" in response.json()["detail"]
    finally:
        db.close()
        Base.metadata.drop_all(bind=db.bind)
        db.bind.dispose()


def test_update_status_colors_and_theme_together():
    db = _make_db()
    try:
        _seed_user(db, color_theme="teal")
        with _setup(db) as client:
            response = client.put(
                "/api/user-settings",
                json={"color_theme": "ocean", "status_colors": {"voorsprong": "#0000ff"}},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["color_theme"] == "ocean"
            assert data["status_colors"]["voorsprong"] == "#0000ff"
    finally:
        db.close()
        Base.metadata.drop_all(bind=db.bind)
        db.bind.dispose()
