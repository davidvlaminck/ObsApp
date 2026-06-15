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


def _clean_text(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    # Strip leading apostrophe (from Excel vocabulary fields)
    if text.startswith("'"):
        text = text[1:]
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        line = line.strip()
        if line:
            line = line.lstrip("•").strip()
            if line:
                cleaned_lines.append(line)
    return "\n".join(cleaned_lines) if cleaned_lines else None


def seed_vo_goals():
    """Import VO-doelen from Excel."""
    from openpyxl import load_workbook
    from app.models.goal import Goal

    db = SessionLocal()
    try:
        excel_path = Path(__file__).resolve().parent.parent.parent / "AnalysisDev" / "Onderwijsdoelen (3).xlsx"
        wb = load_workbook(excel_path, read_only=True)
        ws = wb["Versie 2.0"]

        count = 0
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row[8]:  # Code column
                continue
            code = str(row[8]).strip()
            title = _clean_text(row[9]) or str(row[9]).strip() if row[9] else ""
            description = _clean_text(row[10])
            subject = str(row[4]).strip() if row[4] else ""
            level = "K-"
            goal_type = "VO"
            doel_soort = None
            # Column 5 (index 5) = Type doel: "Na te streven" of "Te bereiken"
            target_type_raw = str(row[5]).strip().lower() if row[5] else ""
            if "na te streven" in target_type_raw:
                target_type = "NA_TE_STREVEN"
            elif "te bereiken" in target_type_raw:
                target_type = "TE_BEREIKEN"
            else:
                target_type = None
            parent_goal_id = None
            vo_code = code
            vocabulary = _clean_text(row[12]) if len(row) > 12 else None
            valid_from = row[13] if len(row) > 13 and row[13] else None
            if hasattr(valid_from, "replace"):
                valid_from = valid_from.replace(tzinfo=None)

            existing = db.query(Goal).filter(Goal.code == code).first()
            if existing:
                continue

            goal = Goal(
                code=code,
                title=title,
                description=description,
                subject=subject,
                level=level,
                goal_type=goal_type,
                doel_soort=doel_soort,
                target_type=target_type,
                parent_goal_id=parent_goal_id,
                vo_code=vo_code,
                vocabulary=vocabulary,
                valid_from=valid_from,
            )
            db.add(goal)
            count += 1

        db.commit()
        wb.close()
        print(f"VO-doelen imported: {count}")
    finally:
        db.close()


if __name__ == "__main__":
    reset_database()
    seed_school_and_admin()
    seed_vo_goals()
