import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.models.school import School
from app.models.user import User
from app.core.security import get_password_hash


def reset_database():
    """Drop all tables and recreate them."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database reset complete.")


def seed_school_and_admin():
    """Create default school and admin user."""
    db = SessionLocal()
    try:
        # Create default school
        school = School(
            name="Demo School",
            slug="demo-school",
            is_active=True,
        )
        db.add(school)
        db.commit()
        db.refresh(school)

        # Create admin user linked to school
        admin = User(
            email="admin@example.com",
            hashed_password=get_password_hash("admin"),
            name="Admin",
            is_superuser=True,
            is_active=True,
            school_id=school.id,
        )
        db.add(admin)
        db.commit()
        print(f"School created: {school.name}")
        print("Admin user created: admin@example.com / admin")
    finally:
        db.close()


if __name__ == "__main__":
    reset_database()
    seed_school_and_admin()
