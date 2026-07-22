from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.core.database import get_db
from app.repositories.theme_repository import ThemeRepository
from app.schemas.theme import ThemeCreate, ThemeResponse, ThemeUpdate
from app.schemas.user import UserResponse

router = APIRouter(prefix="/themes", tags=["themes"])


@router.post("", response_model=ThemeResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ThemeResponse, status_code=status.HTTP_201_CREATED)
def create_theme(
    payload: ThemeCreate,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    repo = ThemeRepository(db)
    existing = repo.get_by_name(payload.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Een thema met deze naam bestaat al.",
        )
    theme = repo.create(payload.name, payload.description)
    return repo.to_response(theme)


@router.get("", response_model=list[ThemeResponse])
@router.get("/", response_model=list[ThemeResponse])
def list_themes(
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    repo = ThemeRepository(db)
    return [repo.to_response(theme) for theme in repo.get_all()]


@router.get("/{theme_id}", response_model=ThemeResponse)
def get_theme(
    theme_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    repo = ThemeRepository(db)
    theme = repo.get_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thema niet gevonden")
    return repo.to_response(theme)


@router.put("/{theme_id}", response_model=ThemeResponse)
def update_theme(
    theme_id: int,
    payload: ThemeUpdate,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    repo = ThemeRepository(db)
    theme = repo.get_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thema niet gevonden")

    if payload.name and payload.name != theme.name:
        existing = repo.get_by_name(payload.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Een thema met deze naam bestaat al.",
            )

    updated = repo.update(theme, payload.name, payload.description)
    return repo.to_response(updated)


@router.delete("/{theme_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_theme(
    theme_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    repo = ThemeRepository(db)
    theme = repo.get_by_id(theme_id)
    if not theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thema niet gevonden")
    repo.delete(theme)
