from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_superuser
from app.core.database import get_db
from app.repositories.school_repository import SchoolRepository
from app.schemas.school import SchoolCreate, SchoolResponse
from app.schemas.user import UserResponse

router = APIRouter(prefix="/schools", tags=["schools"])


@router.post("", response_model=SchoolResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=SchoolResponse, status_code=status.HTTP_201_CREATED)
def create_school(
    payload: SchoolCreate,
    db=Depends(get_db),
    current_superuser: UserResponse = Depends(get_current_superuser),
):
    school_repo = SchoolRepository(db)
    if payload.slug and school_repo.get_by_slug(payload.slug):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Deze slug bestaat al")
    return school_repo.create(payload.name, payload.slug, payload.is_active)


@router.get("", response_model=list[SchoolResponse])
@router.get("/", response_model=list[SchoolResponse])
def list_schools(
    db=Depends(get_db),
    current_superuser: UserResponse = Depends(get_current_superuser),
):
    school_repo = SchoolRepository(db)
    return [school_repo.to_response(school) for school in school_repo.get_all()]
