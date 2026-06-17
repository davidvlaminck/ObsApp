import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import Base, engine, SessionLocal
from app.models.school import School
from app.models.school_year import Class, SchoolYear
from app.models.user import User
from app.models.goal import Goal
from app.models.observation_goal import ObservationGoal
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
        from app.models.school_year import Student
 
        class_model = ClassModel(
            school_year_id=school_year.id,
            name="3K",
            class_type="K3",
        )
        db.add(class_model)
        db.commit()
 
        for student_name in [
            "Lena Peeters",
            "Milan Janssens",
            "Noor De Smet",
            "Finn Willems",
            "Amber Claes",
            "Lucas Vermeulen",
            "Sofie Martens",
            "Daan Goossens",
            "Lotte Maes",
            "Thomas Wouters",
            "Eva Peeters",
            "Seppe Janssens",
            "Maud Jacobs",
            "Ruben De Smet",
            "Julie Willems",
        ]:
            db.add(Student(class_id=class_model.id, name=student_name))
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
 
        teacher = User(
            email="lieve@example.com",
            hashed_password=get_password_hash("lieve"),
            name="Lieve",
            is_superuser=False,
            is_active=True,
            school_id=school.id,
        )
        db.add(teacher)
        db.commit()

        print(f"School created: {school.name}")
        print(f"School year created: {school_year.name}")
        print(f"Class created: {class_model.name}")
        print("Teacher user created: lieve@example.com / lieve")
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
    # Remove HTML tags
    import re
    text = re.sub(r"<[^>]+>", "", text)
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        line = line.strip()
        if line:
            line = line.lstrip("•").strip()
            if line:
                cleaned_lines.append(line)
    return "\n".join(cleaned_lines) if cleaned_lines else None


def _derive_subject_from_filename(stem: str) -> str:
    name = stem
    for prefix in ["LP-", "Op.stap_", "Op stap_"]:
        if name.startswith(prefix):
            name = name[len(prefix):]
    for suffix in [" (1)", "_com_B_S", "_B_S"]:
        if name.endswith(suffix):
            name = name[: -len(suffix)]

    subject_map = {
        "ned": "Nederlands",
        "wiskunde": "Wiskunde",
        "w_t": "Wetenschap en techniek",
        "aardr": "Aardrijkskunde",
        "frans": "Frans",
        "gesch": "Geschiedenis",
        "ict": "ICT",
        "lele": "Levensleer",
        "lo": "Lichamelijke opvoeding",
        "muvo": "Muziek en visuele opvoeding",
        "rkg": "Religie en levensbeschouwing",
        "v_g": "Vormgeving",
    }
    return subject_map.get(name.lower(), name)


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


def _derive_level_from_identifier(identifier: str) -> str:
    """Derive the class level (JK, K2, K3, K-) from an Op Stap identifier."""
    ident = str(identifier)
    # Patterns: .GJK. -> JK, .GK2. or .G K2. -> K2, .GK3. or .G K3. -> K3
    if ".GJK." in ident or ".G JK." in ident:
        return "JK"
    if ".GK2." in ident or ".G K2." in ident:
        return "K2"
    if ".GK3." in ident or ".G K3." in ident:
        return "K3"
    # Patterns: .PF1. -> K-, .PF2. -> K2, .PF3. -> K3
    if ".PF1." in ident:
        return "K-"
    if ".PF2." in ident:
        return "K2"
    if ".PF3." in ident:
        return "K3"
    # Patterns: .GL5. -> K2 (5de leerjaar), .GL6. -> K3 (6de leerjaar)
    if ".GL5." in ident:
        return "K2"
    if ".GL6." in ident:
        return "K3"
    # Patterns: .GL1. -> K2 (1ste leerjaar), .GL2. -> K2, .GL3. -> K3, .GL4. -> K3
    if ".GL1." in ident or ".GL2." in ident:
        return "K2"
    if ".GL3." in ident or ".GL4." in ident:
        return "K3"
    return "K-"


def seed_opstap_goals():
    """Import Op Stap doelen from the generated Excel with minimum goals and examples."""
    from openpyxl import load_workbook

    db = SessionLocal()
    try:
        # First, load all VO goals into a dict keyed by code for linking
        vo_goals = {g.code: g for g in db.query(Goal).filter(Goal.goal_type == "VO").all()}
        print(f"Loaded {len(vo_goals)} VO goals for linking")

        excel_path = Path(__file__).resolve().parent.parent.parent / "AnalysisDev" / "opstap_naar_minimumdoelen.xlsx"
        wb = load_workbook(excel_path, read_only=True)
        ws = wb.active

        # Header: Doel identifier, Doel titel, Pad, Minimumdoel URL, Minimumdoel code, Minimumdoel unieke code, Minimumdoel titel, Voorbeelden
        header = next(ws.iter_rows(min_row=1, max_row=1, values_only=True))
        print(f"Excel header: {header}")

        count = 0
        linked = 0
        seen_codes = set()

        for row in ws.iter_rows(min_row=2, values_only=True):
            goal_identifier = row[0] if len(row) > 0 else None
            if not goal_identifier:
                continue

            code = str(goal_identifier).strip()
            # Handle duplicate codes by appending a counter
            if code in seen_codes:
                counter = 1
                while f"{code}_{counter}" in seen_codes:
                    counter += 1
                code = f"{code}_{counter}"
            seen_codes.add(code)

            title = _clean_text(row[1]) or str(row[1]).strip() if row[1] else ""
            path = str(row[2]).strip() if row[2] else ""
            minimum_goal_code = str(row[4]).strip() if row[4] else ""
            minimum_goal_title = _clean_text(row[6]) or str(row[6]).strip() if row[6] else ""
            voorbeelden = _clean_text(row[7]) if len(row) > 7 else None

            # Derive subject, domain, subdomain, cluster from path
            path_parts = [p.strip() for p in path.split(" > ") if p.strip()]
            subject = path_parts[0] if path_parts else ""
            domain = path_parts[1] if len(path_parts) > 1 else None
            subdomain = path_parts[2] if len(path_parts) > 2 else None
            cluster = path_parts[3] if len(path_parts) > 3 else None

            # Derive level from identifier
            level = _derive_level_from_identifier(goal_identifier)

            # Build description: combine minimum goal title and examples
            description_parts = []
            if minimum_goal_title:
                description_parts.append(minimum_goal_title)
            if voorbeelden:
                description_parts.append(f"Voorbeelden:\n{voorbeelden}")
            description = "\n\n".join(description_parts) if description_parts else None

            # Link to VO goal via minimum_goal_code (remove K- prefix if present)
            vo_code = minimum_goal_code.removeprefix("K-") if minimum_goal_code.startswith("K-") else minimum_goal_code
            parent_goal_id = None
            if vo_code and vo_code in vo_goals:
                parent_goal_id = vo_goals[vo_code].id
                linked += 1

            goal = Goal(
                code=code,
                title=title,
                description=description,
                subject=subject,
                level=level,
                domain=domain,
                subdomain=subdomain,
                cluster=cluster,
                goal_type="OP_STAP",
                minimum_goal_code=minimum_goal_code if minimum_goal_code else None,
                voorbeelden=voorbeelden if voorbeelden else None,
                vo_code=vo_code if vo_code else None,
            )
            db.add(goal)
            count += 1

        db.commit()
        wb.close()
        print(f"Op Stap doelen imported from Excel: {count} (linked to VO: {linked})")
    finally:
        db.close()


def link_demo_observation_goal():
    """Link the demo observation goals to the imported Op Stap goals."""
    demo_goal_specs = [
        # Wiskunde - Getallenkennis
        ("rangtelwoorden", "2.1.GK3.5", "Wiskunde", "Getallenkennis", "Natuurlijke getallen"),
        ("telrij tot 20", "2.1.GK3.1", "Wiskunde", "Getallenkennis", "Natuurlijke getallen"),
        ("aantallen tot 10", "2.1.GK3.3", "Wiskunde", "Getallenkennis", "Natuurlijke getallen"),
        # Wiskunde - Meetkunde
        ("vormen herkennen", "2.1.GK3.7", "Wiskunde", "Meetkunde", "Vormen"),
        # Nederlands - Lezen
        ("klanken herkennen", "2.1.GK3.2", "Nederlands", "Lezen", "Klankbewustzijn"),
        ("tekst begrijpen", "2.1.GK3.4", "Nederlands", "Lezen", "Begrip"),
        # Nederlands - Schrijven
        ("letters schrijven", "2.1.GK3.6", "Nederlands", "Schrijven", "Handschrift"),
    ]

    db = SessionLocal()
    try:
        school = db.query(School).filter_by(slug="demo-school").first()
        class_model = db.query(Class).filter_by(name="3K", class_type="K3").first()
        teacher = db.query(User).filter_by(email="lieve@example.com", school_id=school.id if school else None).first()

        if not school or not class_model or not teacher:
            print("Demo observation goals skipped: required school, class or teacher not found.")
            return

        for name, code, subject, domain, subdomain in demo_goal_specs:
            demo_goal = db.query(Goal).filter_by(code=code).first()
            if not demo_goal:
                print(f"Demo observation goal skipped: Op Stap goal {code} not found.")
                continue

            demo_observation_goal = (
                db.query(ObservationGoal)
                .filter(ObservationGoal.school_id == school.id, ObservationGoal.name == name)
                .first()
            )
            if not demo_observation_goal:
                demo_observation_goal = ObservationGoal(
                    school_id=school.id,
                    created_by=teacher.id,
                    name=name,
                    subject=subject,
                    domain=domain,
                    subdomain=subdomain,
                )
                db.add(demo_observation_goal)

            demo_observation_goal.goal_id = demo_goal.id
            print(f"Demo observation goal prepared: {demo_observation_goal.name} -> {demo_goal.code}")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    reset_database()
    seed_school_and_admin()
    seed_vo_goals()
    seed_opstap_goals()
    link_demo_observation_goal()
