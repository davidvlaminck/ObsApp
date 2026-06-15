import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.models.school import School
from app.models.school_year import SchoolYear
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

        # Create default school year 2026-2027
        school_year = SchoolYear(
            school_id=school.id,
            name="2026-2027",
            start_date=date(2026, 9, 1),
            end_date=date(2027, 6, 30),
            is_active=True,
        )
        db.add(school_year)
        db.commit()
        db.refresh(school_year)

        # Create default class 3K
        from app.models.school_year import Class as ClassModel

        class_model = ClassModel(
            school_year_id=school_year.id,
            name="3K",
            class_type="K3",
        )
        db.add(class_model)
        db.commit()

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
        print(f"School year created: {school_year.name}")
        print(f"Class created: {class_model.name}")
        print("Admin user created: admin@example.com / admin")
    finally:
        db.close()


if __name__ == "__main__":
    reset_database()
    seed_school_and_admin()
