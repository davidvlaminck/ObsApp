from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_superuser
from app.core.config import settings
from app.core.database import get_db
from app.repositories.school_repository import SchoolRepository
from app.services.auth_service import AuthService
from app.services.email_service import send_activation_email
from app.schemas.user import UserCreate, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db=Depends(get_db),
    current_superuser: UserResponse = Depends(get_current_superuser),
):
    user_service = AuthService(db)
    user_repo = user_service.user_repo

    if user_repo.get_by_email(payload.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dit e-mailadres bestaat al")

    if payload.school_id is not None and not SchoolRepository(db).get_by_id(payload.school_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School niet gevonden")

    user = user_service.create_user(
        email=payload.email,
        password=payload.password,
        name=payload.name,
        is_superuser=payload.is_superuser,
        school_id=payload.school_id,
        is_active=payload.is_active,
    )

    if user.is_pending:
        token = user_service.create_activation_token(user)
        activation_link = f"{settings.frontend_base_url}/set-password?token={token}"
        send_activation_email(user.email, activation_link)

    return user_service.user_repo.to_response(user)


@router.get("", response_model=list[UserResponse])
@router.get("/", response_model=list[UserResponse])
def list_users(
    db=Depends(get_db),
    current_superuser: UserResponse = Depends(get_current_superuser),
):
    user_repo = AuthService(db).user_repo
    return [user_repo.to_response(user) for user in user_repo.get_all()]
