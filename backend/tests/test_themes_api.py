import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import auth as auth_module
from app.api import themes as themes_router_module
from app.core.database import Base
from app.models.activity import Activity
from app.models.theme import Theme
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
def theme_db() -> Session:
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
def theme_client(theme_db: Session):
    test_app = FastAPI()
    test_app.include_router(themes_router_module.router, prefix="/api")

    def override_get_db():
        try:
            yield theme_db
        finally:
            pass

    test_app.dependency_overrides[themes_router_module.get_db] = override_get_db
    test_app.dependency_overrides[auth_module.get_current_user] = lambda: TEACHER_RESPONSE

    with TestClient(test_app) as client:
        yield client


def test_create_theme_success(theme_client: TestClient, theme_db: Session):
    response = theme_client.post(
        "/api/themes",
        json={"name": "De appel", "description": "Een fruitthema."},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "De appel"
    assert data["description"] == "Een fruitthema."
    assert theme_db.query(Theme).count() == 1


def test_create_theme_rejects_duplicate_name(theme_client: TestClient, theme_db: Session):
    theme_db.add(Theme(name="De appel", description="Bestaat al."))
    theme_db.commit()

    response = theme_client.post(
        "/api/themes",
        json={"name": "De appel", "description": "Dubbele naam."},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Een thema met deze naam bestaat al."


def test_list_themes_returns_all(theme_client: TestClient, theme_db: Session):
    theme_db.add(Theme(name="De appel", description="Fruit"))
    theme_db.add(Theme(name="De mol", description="Dier"))
    theme_db.commit()

    response = theme_client.get("/api/themes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert {t["name"] for t in data} == {"De appel", "De mol"}


def test_list_themes_includes_activities(theme_client: TestClient, theme_db: Session):
    theme = Theme(name="De appel", description="Fruit")
    theme_db.add(theme)
    theme_db.commit()
    theme_db.refresh(theme)

    theme_db.add(Activity(name="Snoepen", school_id=1, theme_id=theme.id))
    theme_db.add(Activity(name="Koken", school_id=1, theme_id=theme.id))
    theme_db.commit()

    response = theme_client.get("/api/themes")
    assert response.status_code == 200
    data = response.json()
    apple = next(t for t in data if t["name"] == "De appel")
    assert len(apple["activities"]) == 2
    assert [a["name"] for a in apple["activities"]] == ["Snoepen", "Koken"]


def test_update_theme_success(theme_client: TestClient, theme_db: Session):
    theme = Theme(name="De appel", description="Oud")
    theme_db.add(theme)
    theme_db.commit()
    theme_db.refresh(theme)

    response = theme_client.put(
        f"/api/themes/{theme.id}",
        json={"name": "De appel", "description": "Nieuw"},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "Nieuw"


def test_delete_theme_success(theme_client: TestClient, theme_db: Session):
    theme = Theme(name="De mol", description="Te verwijderen")
    theme_db.add(theme)
    theme_db.commit()
    theme_db.refresh(theme)

    response = theme_client.delete(f"/api/themes/{theme.id}")
    assert response.status_code == 204
    assert theme_db.query(Theme).count() == 0


def test_get_theme_includes_activities(theme_client: TestClient, theme_db: Session):
    theme = Theme(name="De appel", description="Fruit")
    theme_db.add(theme)
    theme_db.commit()
    theme_db.refresh(theme)

    theme_db.add(Activity(name="Snoepen", school_id=1, theme_id=theme.id))
    theme_db.commit()

    response = theme_client.get(f"/api/themes/{theme.id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["activities"]) == 1
    assert data["activities"][0]["name"] == "Snoepen"


def test_get_theme_not_found(theme_client: TestClient):
    response = theme_client.get("/api/themes/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Thema niet gevonden"
