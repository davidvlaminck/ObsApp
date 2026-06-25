import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import Base, engine, SessionLocal
from app.models.koepel import Koepel
from app.models.school import School
from app.models.school_year import Class, SchoolYear
from app.models.school_year import Student
from app.models.user import User
from app.models.goal import Goal
from app.models.observation_goal import ObservationGoal
from app.models.student_observation import StudentObservation
from app.core.security import get_password_hash


def reset_database():
    """Drop all tables and recreate them."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Database reset complete.")


def seed_koepels():
    """Seed the 3 koepels: OVSG, GO!, and Katholiek Onderwijs Vlaanderen."""
    db = SessionLocal()
    try:
        koepels = [
            {"name": "OVSG", "slug": "ovsg", "is_active": False},
            {"name": "GO!", "slug": "go", "is_active": False},
            {"name": "Katholiek Onderwijs Vlaanderen", "slug": "katholiek-onderwijs-vlaanderen", "is_active": True},
        ]
        
        for koepel_data in koepels:
            existing = db.query(Koepel).filter(Koepel.slug == koepel_data["slug"]).first()
            if not existing:
                koepel = Koepel(
                    name=koepel_data["name"],
                    slug=koepel_data["slug"],
                    is_active=koepel_data["is_active"],
                )
                db.add(koepel)
                print(f"Koepel created: {koepel_data['name']}")
        
        db.commit()
    finally:
        db.close()


def seed_school_and_admin():
    """Create default school and admin user."""
    db = SessionLocal()
    try:
        # Get Katholiek Onderwijs Vlaanderen koepel
        kov = db.query(Koepel).filter(Koepel.slug == "katholiek-onderwijs-vlaanderen").first()
        
        # Create default school
        school = School(
            name="Demo School",
            slug="demo-school",
            is_active=True,
            koepel_id=kov.id if kov else None,
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



def seed_mow_user():
    """Create MOW user (david.vlaminck@mow.vlaanderen.be) without koepel selection."""
    db = SessionLocal()
    try:
        # Create school for MOW user (without koepel)
        school = School(
            name="MOW Test School",
            slug="mow-test-school",
            is_active=True,
            koepel_id=None,  # No koepel selected yet
        )
        db.add(school)
        db.commit()
        db.refresh(school)

        # Create MOW user
        mow_user = User(
            email="david.vlaminck@mow.vlaanderen.be",
            hashed_password=get_password_hash("testtest"),
            name="David Vlaminck",
            is_superuser=False,
            is_active=True,
            school_id=school.id,
            is_pending=False,
        )
        db.add(mow_user)
        db.commit()
        
        print(f"MOW user created: david.vlaminck@mow.vlaanderen.be / testtest (no koepel selected)")
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
    return _normalize_subject(subject_map.get(name.lower(), name))


def _normalize_subject(value: str) -> str:
    if value.lower() in {"nederlands en communicatie", "nederlands & communicatie", "nederlands-communicatie"}:
        return "Nederlands"
    return value


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
            subject = _normalize_subject(str(row[4]).strip() if row[4] else "")
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
        
        # Get Katholiek Onderwijs Vlaanderen koepel for linking
        kov = db.query(Koepel).filter(Koepel.slug == "katholiek-onderwijs-vlaanderen").first()
        print(f"Katholiek Onderwijs Vlaanderen koepel: {kov.name if kov else 'not found'}")

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
            subject = _normalize_subject(path_parts[0]) if path_parts else ""
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
            if vo_code and vo_code in vo_goals:
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
                koepel_id=kov.id if kov else None,
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
        ("woorden lezen", "2.1.GK3.2", "Nederlands", "Lezen", "Woordlezen"),
        ("tekst begrijpen", "2.1.GK3.4", "Nederlands", "Lezen", "Begrip"),
        ("luisteren naar verhalen", "2.1.GK3.4", "Nederlands", "Lezen", "Luisteren"),
        # Nederlands - Schrijven
        ("letters schrijven", "2.1.GK3.2", "Nederlands", "Schrijven", "Handschrift"),
        ("woorden schrijven", "2.1.GK3.4", "Nederlands", "Schrijven", "Spelling"),
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


def seed_static_class_observations():
    seeded_class_observations = [
        ("klanken herkennen", 0, "in_ontwikkeling", date(2026, 10, 5), "Voorbeeldcommentaar: herkent de begin- en eindklank."),
        ("klanken herkennen", 1, "zelfstandig", date(2026, 10, 6), None),
        ("klanken herkennen", 2, "voorsprong", date(2026, 10, 7), None),
        ("klanken herkennen", 3, "in_ontwikkeling", date(2026, 10, 8), None),
        ("klanken herkennen", 4, "zelfstandig", date(2026, 10, 9), None),
        ("klanken herkennen", 5, "voorsprong", date(2026, 10, 10), None),
        ("klanken herkennen", 6, "onvoldoende", date(2026, 10, 11), None),
        ("klanken herkennen", 7, "in_ontwikkeling", date(2026, 10, 12), None),
        ("klanken herkennen", 8, "zelfstandig", date(2026, 10, 13), None),
        ("klanken herkennen", 9, "voorsprong", date(2026, 10, 14), None),
        ("klanken herkennen", 10, "in_ontwikkeling", date(2026, 10, 15), None),
        ("klanken herkennen", 11, "zelfstandig", date(2026, 10, 16), None),
        ("klanken herkennen", 12, "voorsprong", date(2026, 10, 17), None),
        ("klanken herkennen", 13, "onvoldoende", date(2026, 10, 18), None),
        ("klanken herkennen", 14, "in_ontwikkeling", date(2026, 10, 19), None),
        ("woorden lezen", 0, "zelfstandig", date(2026, 10, 20), None),
        ("woorden lezen", 1, "voorsprong", date(2026, 10, 21), None),
        ("woorden lezen", 2, "in_ontwikkeling", date(2026, 10, 22), None),
        ("woorden lezen", 3, "zelfstandig", date(2026, 10, 23), None),
        ("woorden lezen", 4, "voorsprong", date(2026, 10, 24), None),
        ("woorden lezen", 5, "onvoldoende", date(2026, 10, 25), None),
        ("woorden lezen", 6, "in_ontwikkeling", date(2026, 10, 26), None),
        ("woorden lezen", 7, "zelfstandig", date(2026, 10, 27), None),
        ("woorden lezen", 8, "voorsprong", date(2026, 10, 28), None),
        ("woorden lezen", 9, "in_ontwikkeling", date(2026, 10, 29), None),
        ("woorden lezen", 10, "zelfstandig", date(2026, 10, 30), None),
        ("woorden lezen", 11, "voorsprong", date(2026, 10, 31), None),
        ("woorden lezen", 12, "onvoldoende", date(2026, 11, 1), None),
        ("woorden lezen", 13, "in_ontwikkeling", date(2026, 11, 2), None),
        ("woorden lezen", 14, "zelfstandig", date(2026, 11, 3), None),
        ("luisteren naar verhalen", 0, "voorsprong", date(2026, 11, 4), None),
        ("luisteren naar verhalen", 1, "in_ontwikkeling", date(2026, 11, 5), None),
        ("luisteren naar verhalen", 2, "zelfstandig", date(2026, 11, 6), None),
        ("luisteren naar verhalen", 3, "voorsprong", date(2026, 11, 7), None),
        ("luisteren naar verhalen", 4, "onvoldoende", date(2026, 11, 8), None),
        ("luisteren naar verhalen", 5, "in_ontwikkeling", date(2026, 11, 9), None),
        ("luisteren naar verhalen", 6, "zelfstandig", date(2026, 11, 10), None),
        ("luisteren naar verhalen", 7, "voorsprong", date(2026, 11, 11), None),
        ("luisteren naar verhalen", 8, "in_ontwikkeling", date(2026, 11, 12), None),
        ("luisteren naar verhalen", 9, "zelfstandig", date(2026, 11, 13), None),
        ("luisteren naar verhalen", 10, "voorsprong", date(2026, 11, 14), None),
        ("luisteren naar verhalen", 11, "onvoldoende", date(2026, 11, 15), None),
        ("luisteren naar verhalen", 12, "in_ontwikkeling", date(2026, 11, 16), None),
        ("luisteren naar verhalen", 13, "zelfstandig", date(2026, 11, 17), None),
        ("luisteren naar verhalen", 14, "voorsprong", date(2026, 11, 18), None),
        ("rangtelwoorden", 0, "zelfstandig", date(2026, 11, 19), None),
        ("rangtelwoorden", 1, "voorsprong", date(2026, 11, 20), None),
        ("rangtelwoorden", 2, "in_ontwikkeling", date(2026, 11, 21), None),
        ("rangtelwoorden", 3, "zelfstandig", date(2026, 11, 22), None),
        ("rangtelwoorden", 4, "voorsprong", date(2026, 11, 23), None),
        ("rangtelwoorden", 5, "onvoldoende", date(2026, 11, 24), None),
        ("rangtelwoorden", 6, "in_ontwikkeling", date(2026, 11, 25), None),
        ("rangtelwoorden", 7, "zelfstandig", date(2026, 11, 26), None),
        ("rangtelwoorden", 8, "voorsprong", date(2026, 11, 27), None),
        ("rangtelwoorden", 9, "in_ontwikkeling", date(2026, 11, 28), None),
        ("rangtelwoorden", 10, "zelfstandig", date(2026, 11, 29), None),
        ("rangtelwoorden", 11, "voorsprong", date(2026, 11, 30), None),
        ("rangtelwoorden", 12, "onvoldoende", date(2026, 12, 1), None),
        ("rangtelwoorden", 13, "in_ontwikkeling", date(2026, 12, 2), None),
        ("rangtelwoorden", 14, "zelfstandig", date(2026, 12, 3), None),
        ("vormen herkennen", 0, "voorsprong", date(2026, 12, 4), None),
        ("vormen herkennen", 1, "in_ontwikkeling", date(2026, 12, 5), None),
        ("vormen herkennen", 2, "zelfstandig", date(2026, 12, 6), None),
        ("vormen herkennen", 3, "voorsprong", date(2026, 12, 7), None),
        ("vormen herkennen", 4, "onvoldoende", date(2026, 12, 8), None),
        ("vormen herkennen", 5, "in_ontwikkeling", date(2026, 12, 9), None),
        ("vormen herkennen", 6, "zelfstandig", date(2026, 12, 10), None),
        ("vormen herkennen", 7, "voorsprong", date(2026, 12, 11), None),
        ("vormen herkennen", 8, "in_ontwikkeling", date(2026, 12, 12), None),
        ("vormen herkennen", 9, "zelfstandig", date(2026, 12, 13), None),
        ("vormen herkennen", 10, "voorsprong", date(2026, 12, 14), None),
        ("vormen herkennen", 11, "onvoldoende", date(2026, 12, 15), None),
        ("vormen herkennen", 12, "in_ontwikkeling", date(2026, 12, 16), None),
        ("vormen herkennen", 13, "zelfstandig", date(2026, 12, 17), None),
        ("vormen herkennen", 14, "voorsprong", date(2026, 12, 18), None),
    ]

    db = SessionLocal()
    try:
        school = db.query(School).filter_by(slug="demo-school").first()
        class_model = db.query(Class).filter_by(name="3K", class_type="K3").first()
        teacher = db.query(User).filter_by(email="lieve@example.com", school_id=school.id if school else None).first()
        students = (
            db.query(Student)
            .filter(Student.class_id == class_model.id)
            .order_by(Student.name)
            .all()
            if class_model
            else []
        )

        if not school or not class_model or not teacher or not students:
            print("Static class observations skipped: required school, class, teacher or students not found.")
            return

        observation_goals = {
            goal.name: goal
            for goal in db.query(ObservationGoal)
            .filter(ObservationGoal.school_id == school.id)
            .all()
        }

        for goal_name, student_index, status, observation_date, comment in seeded_class_observations:
            if student_index >= len(students) or goal_name not in observation_goals:
                continue

            observation_goal = observation_goals[goal_name]
            student = students[student_index]
            existing = (
                db.query(StudentObservation)
                .filter(
                    StudentObservation.observation_goal_id == observation_goal.id,
                    StudentObservation.student_id == student.id,
                )
                .first()
            )
            if existing:
                continue

            db.add(
                StudentObservation(
                    school_id=school.id,
                    observation_goal_id=observation_goal.id,
                    student_id=student.id,
                    observed_by=teacher.id,
                    status=status,
                    observation_date=observation_date,
                    comment=comment,
                )
            )

        db.commit()
        print(f"Static class observations seeded: {len(seeded_class_observations)} observations.")
    finally:
        db.close()


if __name__ == "__main__":
    reset_database()
    seed_koepels()
    seed_school_and_admin()
    seed_mow_user()
    seed_vo_goals()
    seed_opstap_goals()
    link_demo_observation_goal()
    seed_static_class_observations()
