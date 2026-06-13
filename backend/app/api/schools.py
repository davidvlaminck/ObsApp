from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_school_user, get_current_superuser
from app.core.database import get_db
from app.repositories.school_repository import SchoolRepository
from app.repositories.school_year_repository import ClassRepository, SchoolYearRepository
from app.schemas.school import ClassCreate, ClassResponse, SchoolCreate, SchoolResponse, SchoolYearCreate, SchoolYearResponse
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
    return school_repo.to_response(school_repo.create(payload.name, payload.slug, payload.is_active))


@router.get("", response_model=list[SchoolResponse])
@router.get("/", response_model=list[SchoolResponse])
def list_schools(
    db=Depends(get_db),
    current_superuser: UserResponse = Depends(get_current_superuser),
):
    school_repo = SchoolRepository(db)
    return [school_repo.to_response(school) for school in school_repo.get_all()]


@router.get("/{school_id}/school-years", response_model=list[SchoolYearResponse])
def list_school_years(
    school_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    if current_user.school_id != school_id and not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Niet bevoegd")
    school_repo = SchoolRepository(db)
    if not school_repo.get_by_id(school_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School niet gevonden")
    year_repo = SchoolYearRepository(db)
    return [year_repo.to_response(year) for year in year_repo.get_by_school(school_id)]


@router.post("/{school_id}/school-years", response_model=SchoolYearResponse, status_code=status.HTTP_201_CREATED)
def create_school_year(
    school_id: int,
    payload: SchoolYearCreate,
    db=Depends(get_db),
    current_superuser: UserResponse = Depends(get_current_superuser),
):
    school_repo = SchoolRepository(db)
    if not school_repo.get_by_id(school_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School niet gevonden")
    year_repo = SchoolYearRepository(db)
    school_year = year_repo.create(school_id, payload.name, payload.start_date, payload.end_date, payload.is_active)
    return year_repo.to_response(school_year)


@router.post("/school-years/{school_year_id}/activate", response_model=SchoolYearResponse)
def activate_school_year(
    school_year_id: int,
    db=Depends(get_db),
    current_superuser: UserResponse = Depends(get_current_superuser),
):
    year_repo = SchoolYearRepository(db)
    school_year = year_repo.get_by_id(school_year_id)
    if not school_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schooljaar niet gevonden")
    return year_repo.to_response(year_repo.set_active(school_year_id))


@router.get("/school-years/{school_year_id}/classes", response_model=list[ClassResponse])
def list_classes(
    school_year_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    year_repo = SchoolYearRepository(db)
    school_year = year_repo.get_by_id(school_year_id)
    if not school_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schooljaar niet gevonden")
    if current_user.school_id != school_year.school_id and not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Niet bevoegd")
    class_repo = ClassRepository(db)
    return [class_repo.class_to_response(cls) for cls in class_repo.get_classes_by_school_year(school_year_id)]


@router.post("/school-years/{school_year_id}/classes", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(
    school_year_id: int,
    payload: ClassCreate,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_school_user),
):
    year_repo = SchoolYearRepository(db)
    school_year = year_repo.get_by_id(school_year_id)
    if not school_year:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schooljaar niet gevonden")
    if current_user.school_id != school_year.school_id and not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Niet bevoegd")
    class_repo = ClassRepository(db)
    class_model = class_repo.create_class(school_year_id, payload.name)
    return class_repo.class_to_response(class_model)
