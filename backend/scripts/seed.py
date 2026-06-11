import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.models.user import User
from app.core.security import get_password_hash


def reset_database():
    """Drop all tables and recreate them."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database reset complete.")


def seed_admin_user():
    """Create default admin user if it doesn't exist."""
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "admin@example.com").first()
        if existing:
            print("Admin user already exists.")
            return

        admin = User(
            email="admin@example.com",
            hashed_password=get_password_hash("admin"),
            name="Admin",
            is_superuser=True,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print("Admin user created: admin@example.com / admin")
    finally:
        db.close()


if __name__ == "__main__":
    reset_database()
    seed_admin_user()
