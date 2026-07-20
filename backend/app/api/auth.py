import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy import delete, select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.goal import Goal
from app.models.koepel import Koepel
from app.models.observation import Observation
from app.models.observation_goal import ObservationGoal
from app.models.school import School
from app.models.school_year import Class, SchoolYear, Student
from app.models.student_observation import StudentObservation
from app.schemas.auth import KoepelResponse, LoginRequest, SetPasswordRequest, TokenResponse
from app.schemas.school import SchoolResponse
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

# Import limiter from core module to avoid circular import
from app.core.limiter import limiter

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Demo students
DEMO_STUDENTS = [
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
]

# Demo observation goal specs (name, code, subject, domain, subdomain)
DEMO_OBSERVATION_GOALS = [
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

# Demo class observations (goal_name, student_index, status, observation_date, comment)
DEMO_CLASS_OBSERVATIONS = [
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
]


class KoepelSelectRequest(BaseModel):
    koepel: str
    class_type: str | None = None  # "JK", "K2", or "K3" - defaults to "K3" for demo data


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, credentials: LoginRequest, db=Depends(get_db)):
    service = AuthService(db)
    user = service.authenticate_user(credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ongeldige inloggegevens",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # For demo users, use demo_school_id; for regular users, use school_id
    effective_school_id = user.demo_school_id if user.is_demo else user.school_id
    access_token = create_access_token(
        data={"sub": user.email, "school_id": effective_school_id},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return TokenResponse(
        access_token=access_token,
        needs_koepel_selection=user.needs_koepel_selection,
    )


@router.get("/koepels", response_model=list[KoepelResponse])
async def list_koepels(db=Depends(get_db)):
    koepels = db.query(Koepel).filter(Koepel.is_active == True).all()
    return [
        KoepelResponse(
            id=k.id,
            name=k.name,
            slug=k.slug,
            is_active=k.is_active,
        )
        for k in koepels
    ]


async def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)) -> UserResponse:
    service = AuthService(db)
    user = service.get_user_from_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ongeldige of verlopen token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_current_superuser(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    if not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Niet bevoegd")
    return current_user


async def get_current_school_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    # Check for school access: either school_id (regular) or demo_school_id (demo)
    if not current_user.school_id and not current_user.demo_school_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Niet bevoegd")
    # For demo users, return a response with school_id set to demo_school_id
    if current_user.is_demo and current_user.demo_school_id:
        return UserResponse(
            id=current_user.id,
            email=current_user.email,
            name=current_user.name,
            is_active=current_user.is_active,
            is_superuser=current_user.is_superuser,
            is_pending=current_user.is_pending,
            school_id=current_user.demo_school_id,
            is_demo=current_user.is_demo,
            demo_school_id=current_user.demo_school_id,
            demo_expires_at=current_user.demo_expires_at,
            needs_koepel_selection=current_user.needs_koepel_selection,
        )
    return current_user


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user


@router.post("/set-password", response_model=UserResponse)
async def set_password(payload: SetPasswordRequest, db=Depends(get_db)):
    service = AuthService(db)
    try:
        user = service.set_password(payload.token, payload.password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return service.user_repo.to_response(user, service._needs_koepel_selection(user))


@router.post("/select-koepel", response_model=UserResponse)
async def select_koepel(
    payload: KoepelSelectRequest,
    current_user: UserResponse = Depends(get_current_user),
    db=Depends(get_db),
):
    """Select koepel for the user's school (first user only). For demo users, creates demo school/year/class."""
    service = AuthService(db)
    
    # Get the user
    user = service.user_repo.get_by_email(current_user.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gebruiker niet gevonden",
        )
    
    # For demo users, create the demo school after koepel selection
    if user.is_demo:
        # Create personal demo school
        demo_school = School(
            name=f"Demo School - {user.id}",
            slug=f"demo-school-{user.id}-{uuid.uuid4().hex[:8]}",
            is_active=True,
            is_demo=True,
        )
        db.add(demo_school)
        db.commit()
        db.refresh(demo_school)
        
        # Update user with demo_school_id
        user.demo_school_id = demo_school.id
        db.commit()
        db.refresh(user)
        
        # Create school year
        school_year = SchoolYear(
            school_id=demo_school.id,
            name="2026-2027",
            start_date=date(2026, 9, 1),
            end_date=date(2027, 6, 30),
            is_active=True,
        )
        db.add(school_year)
        db.commit()
        db.refresh(school_year)
        
        # Create 3 classes: JK, 2K, 3K
        class_models = {}
        for class_name, class_type in [("JK", "JK"), ("2K", "K2"), ("3K", "K3")]:
            class_model = Class(
                school_year_id=school_year.id,
                name=class_name,
                class_type=class_type,
            )
            db.add(class_model)
            db.commit()
            db.refresh(class_model)
            class_models[class_name] = class_model
        
        # Create demo students in 3K (where demo observations will be)
        for student_name in DEMO_STUDENTS:
            db.add(Student(class_id=class_models["3K"].id, name=student_name))
        db.commit()
        
        # Create demo observation goals
        for name, code, subject, domain, subdomain in DEMO_OBSERVATION_GOALS:
            demo_goal = db.query(Goal).filter_by(code=code).first()
            if demo_goal:
                demo_observation_goal = ObservationGoal(
                    school_id=demo_school.id,
                    created_by=user.id,
                    name=name,
                    subject=subject,
                    domain=domain,
                    subdomain=subdomain,
                    class_id=class_models["3K"].id,  # Link to 3K class
                )
                db.add(demo_observation_goal)
                demo_observation_goal.goal_id = demo_goal.id
        db.commit()
        
        # Create demo student observations
        students = (
            db.query(Student)
            .filter(Student.class_id == class_models["3K"].id)
            .order_by(Student.name)
            .all()
        )
        observation_goals = {
            goal.name: goal
            for goal in db.query(ObservationGoal)
            .filter(ObservationGoal.school_id == demo_school.id)
            .all()
        }
        
        for goal_name, student_index, status, observation_date, comment in DEMO_CLASS_OBSERVATIONS:
            if student_index < len(students) and goal_name in observation_goals:
                observation_goal = observation_goals[goal_name]
                student = students[student_index]
                db.add(
                    StudentObservation(
                        school_id=demo_school.id,
                        observation_goal_id=observation_goal.id,
                        student_id=student.id,
                        observed_by=user.id,
                        status=status,
                        observation_date=observation_date,
                        comment=comment,
                    )
                )
        db.commit()
        
        # Set the koepel on the demo school
        demo_school.koepel = payload.koepel
        
        # Set the default class on the user based on selection
        # Map class_type to class name: "JK" -> "JK", "K2" -> "2K", "K3" -> "3K"
        class_name_map = {"JK": "JK", "K2": "2K", "K3": "3K"}
        selected_class_name = class_name_map.get(payload.class_type, "3K")
        user.default_class_id = class_models[selected_class_name].id
        
        db.commit()
        
        return service.user_repo.to_response(user)
    
    # For regular users, use existing school
    school_id = user.school_id
    
    if not school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geen school gekoppeld aan gebruiker",
        )
    
    # Get the school
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School niet gevonden",
        )
    
    # Check if koepel is already set
    if school.koepel:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Koepel is al ingesteld",
        )
    
    # Set the koepel
    school.koepel = payload.koepel
    db.commit()
    
    return service.user_repo.to_response(user)


@router.get("/my-school", response_model=SchoolResponse | None)
async def get_my_school(
    current_user: UserResponse = Depends(get_current_user),
    db=Depends(get_db),
):
    """Get the current user's school (regular or demo)."""
    school_id = current_user.demo_school_id if current_user.is_demo else current_user.school_id
    if not school_id:
        return None

    school = db.get(School, school_id)
    if not school:
        return None

    return SchoolResponse(
        id=school.id,
        name=school.name,
        slug=school.slug,
        is_active=school.is_active,
        created_at=school.created_at,
    )


@router.post("/reset-demo", response_model=UserResponse)
async def reset_demo(
    current_user: UserResponse = Depends(get_current_user),
    db=Depends(get_db),
):
    """Reset demo data for the current demo user."""
    if not current_user.is_demo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Alleen demo gebruikers kunnen hun data resetten",
        )

    service = AuthService(db)
    user = service.user_repo.get_by_email(current_user.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gebruiker niet gevonden",
        )

    demo_school_id = user.demo_school_id
    if not demo_school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geen demo school gevonden",
        )

    # Clear demo_school_id and default_class_id from user FIRST (to avoid FK constraint violation)
    user.demo_school_id = None
    user.default_class_id = None
    db.add(user)
    db.commit()
    
    # Delete related data in order to respect foreign keys
    # Order matters: delete children first, then parents
    db.execute(delete(StudentObservation).where(StudentObservation.school_id == demo_school_id))
    db.execute(delete(Observation).where(Observation.school_id == demo_school_id))
    db.execute(delete(ObservationGoal).where(ObservationGoal.school_id == demo_school_id))
    
    # Get school year IDs for this school
    school_year_ids = [sy.id for sy in db.query(SchoolYear.id).filter(SchoolYear.school_id == demo_school_id).all()]
    
    # Get class IDs for these school years
    class_ids = [c.id for c in db.query(Class.id).filter(Class.school_year_id.in_(school_year_ids)).all()]
    
    # Delete students, then classes, then school years
    if class_ids:
        db.execute(delete(Student).where(Student.class_id.in_(class_ids)))
    db.execute(delete(Class).where(Class.school_year_id.in_(school_year_ids)))
    db.execute(delete(SchoolYear).where(SchoolYear.school_id == demo_school_id))

    # Delete the demo school
    db.execute(delete(School).where(School.id == demo_school_id))
    db.commit()
    db.refresh(user)

    return service.user_repo.to_response(user)
