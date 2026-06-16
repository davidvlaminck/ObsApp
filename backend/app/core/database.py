from threading import Lock

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, echo=settings.debug)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

_initialized = False
_initialize_lock = Lock()


def initialize_database():
    global _initialized

    with _initialize_lock:
        if _initialized:
            return

        Base.metadata.create_all(bind=engine)
        ensure_user_columns()
        ensure_goal_columns()
        seed_default_data()
        _initialized = True


def ensure_user_columns():
    columns = {column["name"] for column in inspect(engine).get_columns("users")}
    with engine.begin() as connection:
        if "hashed_password" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN hashed_password VARCHAR"))
        if "is_pending" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_pending BOOLEAN DEFAULT false"))
        if "password_reset_token" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN password_reset_token VARCHAR"))
        if "password_reset_expires_at" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMP"))
        if "school_id" not in columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN school_id INTEGER"))


def ensure_goal_columns():
    columns = {column["name"] for column in inspect(engine).get_columns("goals")}
    with engine.begin() as connection:
        if "domain" not in columns:
            connection.execute(text("ALTER TABLE goals ADD COLUMN domain VARCHAR"))
        if "subdomain" not in columns:
            connection.execute(text("ALTER TABLE goals ADD COLUMN subdomain VARCHAR"))
        if "cluster" not in columns:
            connection.execute(text("ALTER TABLE goals ADD COLUMN cluster VARCHAR"))
        if "minimum_goal_code" not in columns:
            connection.execute(text("ALTER TABLE goals ADD COLUMN minimum_goal_code VARCHAR"))
        if "voorbeelden" not in columns:
            connection.execute(text("ALTER TABLE goals ADD COLUMN voorbeelden TEXT"))

        connection.execute(
            text(
                """
                UPDATE goals
                SET subject = CASE
                    WHEN lower(subject) IN ('ned', 'ned_com') THEN 'Nederlands'
                    WHEN lower(subject) IN ('wiskunde', 'w_t') THEN 'Wiskunde'
                    WHEN lower(subject) IN ('aardr') THEN 'Aardrijkskunde'
                    WHEN lower(subject) IN ('gesch') THEN 'Geschiedenis'
                    WHEN lower(subject) IN ('v_g') THEN 'Vormgeving'
                    WHEN lower(subject) IN ('lele') THEN 'Levensleer'
                    WHEN lower(subject) IN ('muvo') THEN 'Muziek en visuele opvoeding'
                    WHEN lower(subject) IN ('rkg') THEN 'Religie en levensbeschouwing'
                    ELSE subject
                END
                WHERE subject IS NOT NULL
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE goals
                SET subdomain = level
                WHERE subdomain IS NULL
                  AND level IS NOT NULL
                """
            )
        )


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


def get_db():
    initialize_database()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
