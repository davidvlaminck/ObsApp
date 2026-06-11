import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.config import settings


@pytest.fixture(scope="session")
def sqlite_engine():
    """Create a SQLite engine for testing."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sqlite_db(sqlite_engine):
    """Create a SQLite session for testing."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sqlite_engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session")
def postgres_engine():
    """Create a PostgreSQL engine for integration testing."""
    if "postgresql" not in settings.database_url:
        pytest.skip("PostgreSQL integration tests require DATABASE_URL to be set to PostgreSQL")
    engine = create_engine(settings.database_url, echo=False)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def postgres_db(postgres_engine):
    """Create a PostgreSQL session for integration testing."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=postgres_engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session")
def postgres_engine():
    """Create a PostgreSQL engine for integration testing."""
    if "postgresql" not in settings.database_url:
        pytest.skip("PostgreSQL integration tests require DATABASE_URL to be set to PostgreSQL")
    engine = create_engine(settings.database_url, echo=False)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def postgres_db(postgres_engine):
    """Create a PostgreSQL session for integration testing."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=postgres_engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
