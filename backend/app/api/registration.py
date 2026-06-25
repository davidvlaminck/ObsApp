"""Registration API endpoints for demo and regular user registration."""
import uuid
from datetime import date

import httpx
from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.database import get_db
from app.models.school import School
from app.models.school_year import Class, SchoolYear, Student
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService
from app.services.email_service import send_activation_email

router = APIRouter(prefix="/register", tags=["registration"])

# Demo students
DEMO_STUDENTS = [
    "Lena Peeters",
    "Milan Janssens",
    "Noor De Smet",
    "Finn Willems",
    "Amber Claes",
]


def fetch_scholen_from_vlaanderen() -> list[dict]:
    """
    Fetch school list from Vlaanderen data source.
    API: https://data-onderwijs.vlaanderen.be/onderwijsaanbod/lijst?n=1&hz=true&hs=111
    """
    url = "https://data-onderwijs.vlaanderen.be/onderwijsaanbod/lijst"
    params = {"n": 1, "hz": "true", "hs": "111"}

    try:
        response = httpx.get(url, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()

        # Transform to our format
        schools = []
        for item in data.get("aanbod", []):
            schools.append({
                "id": item.get("inszCode"),
                "name": item.get("naam"),
                "slug": item.get("inszCode"),
                "is_active": True,
            })
        return schools
    except Exception:
        # Return empty list on error - will be handled gracefully
        return []


@router.get("/schools", response_model=list[dict])
def get_scholen():
    """
    Get list of schools from Vlaanderen data source.
    Documentatie: https://data-onderwijs.vlaanderen.be/onderwijsaanbod/lijst?n=1&hz=true&hs=111
    """
    return fetch_scholen_from_vlaanderen()


class DemoRegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1)


class RegularRegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1)
    school_id: int | None = None
    school_name: str | None = None


@router.post("/demo", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_demo(
    payload: DemoRegisterRequest,
    db=Depends(get_db),
):
    """
    Register a demo account. School will be created after koepel selection.
    """
    service = AuthService(db)
    user_repo = service.user_repo

    # Check if email already exists
    if user_repo.get_by_email(payload.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dit e-mailadres bestaat al",
        )

    # Create demo user (no school yet)
    user = service.create_demo_user(
        email=payload.email,
        name=payload.name,
    )

    # Create activation token and send email
    token = service.create_activation_token(user)
    activation_link = f"{settings.frontend_base_url}/set-password?token={token}"
    try:
        send_activation_email(user.email, activation_link)
    except Exception:
        # Log error but don't fail registration
        pass

    return user_repo.to_response(user)


@router.post("/regular", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_regular(
    payload: RegularRegisterRequest,
    db=Depends(get_db),
):
    """
    Register a regular account. User must select a school or provide a custom school name.
    """
    service = AuthService(db)
    user_repo = service.user_repo

    # Check if email already exists
    if user_repo.get_by_email(payload.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dit e-mailadres bestaat al",
        )

    # Validate that either school_id or school_name is provided
    if not payload.school_id and not payload.school_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selecteer een school of geef een andere school op",
        )

    school_id = payload.school_id

    # If school_name is provided, create a new school
    if payload.school_name:
        school = School(
            name=payload.school_name,
            slug=f"school-{uuid.uuid4().hex[:8]}",
            is_active=True,
        )
        db.add(school)
        db.commit()
        db.refresh(school)
        school_id = school.id

    # Create user
    user = user_repo.create(
        email=payload.email,
        hashed_password=None,
        name=payload.name,
        is_superuser=False,
        school_id=school_id,
        is_active=True,
        is_pending=True,
    )

    # Create activation token and send email
    token = service.create_activation_token(user)
    activation_link = f"{settings.frontend_base_url}/set-password?token={token}"
    try:
        send_activation_email(user.email, activation_link)
    except Exception:
        # Log error but don't fail registration
        pass

    return user_repo.to_response(user)