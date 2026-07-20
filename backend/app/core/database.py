from threading import Lock

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings, BASE_DIR

Base = declarative_base()

engine = create_engine(settings.database_url, echo=settings.debug)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

_initialized = False
_initialize_lock = Lock()


def run_alembic_migrations() -> None:
    """Run pending Alembic migrations to bring the database up to date."""
    from alembic import command
    from alembic.config import Config

    alembic_cfg = Config(str(BASE_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(alembic_cfg, "head")


def seed_default_data():
    from app.core.security import get_password_hash
    from app.models.school import School
    from app.models.user import User

    db = SessionLocal()
    try:
        school = db.query(School).filter(School.slug == "demo-school").first()
        if not school:
            school = School(name="Demo School", slug="demo-school", is_active=True)
            db.add(school)
            db.commit()
            db.refresh(school)

        if not db.query(User).filter(User.email == "admin@example.com").first():
            db.add(
                User(
                    email="admin@example.com",
                    hashed_password=get_password_hash("admin"),
                    name="Admin",
                    is_superuser=True,
                    is_active=True,
                    is_pending=False,
                    school_id=school.id,
                )
            )
            db.commit()
            print("Seeded default admin user: admin@example.com / admin")
    finally:
        db.close()


def initialize_database():
    global _initialized

    with _initialize_lock:
        if _initialized:
            return

        # Create tables that don't exist yet (for fresh databases)
        Base.metadata.create_all(bind=engine)
        # Apply any pending Alembic migrations
        run_alembic_migrations()
        seed_default_data()
        _initialized = True


def get_db():
    initialize_database()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
