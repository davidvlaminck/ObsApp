import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.koepel import Koepel
from app.models.school import School
from app.models.school_year import Class, SchoolYear, Student
from app.schemas.auth import LoginRequest, SetPasswordRequest, TokenResponse
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Demo students
DEMO_STUDENTS = [
    "Lena Peeters",
    "Milan Janssens",
    "Noor De Smet",
    "Finn Willems",
    "Amber Claes",
]


class KoepelSelectRequest(BaseModel):
    koepel: str


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db=Depends(get_db)):
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
        
        # Create class
        class_model = Class(
            school_year_id=school_year.id,
            name="3K",
            class_type="K3",
        )
        db.add(class_model)
        db.commit()
        db.refresh(class_model)
        
        # Create demo students
        for student_name in DEMO_STUDENTS:
            db.add(Student(class_id=class_model.id, name=student_name))
        db.commit()
        
        # Set the koepel on the demo school
        demo_school.koepel = payload.koepel
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
