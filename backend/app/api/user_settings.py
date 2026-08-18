from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.core.database import get_db
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserResponse, UserSettingsResponse, UserSettingsUpdate

router = APIRouter(prefix="/user-settings", tags=["user-settings"])

VALID_COLOR_THEMES = {"teal", "ocean", "forest", "sunset", "purple"}


@router.get("", response_model=UserSettingsResponse)
@router.get("/", response_model=UserSettingsResponse)
def get_user_settings(
    current_user: UserResponse = Depends(get_current_user),
    db=Depends(get_db),
):
    user = UserRepository(db).get_by_id(current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gebruiker niet gevonden")
    return UserSettingsResponse(color_theme=user.color_theme or "teal")


@router.put("", response_model=UserSettingsResponse)
@router.put("/", response_model=UserSettingsResponse)
def update_user_settings(
    payload: UserSettingsUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db=Depends(get_db),
):
    if payload.color_theme is not None and payload.color_theme not in VALID_COLOR_THEMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ongeldig thema. Kies een van: {', '.join(sorted(VALID_COLOR_THEMES))}",
        )

    repo = UserRepository(db)
    user = repo.get_by_id(current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gebruiker niet gevonden")

    new_theme = payload.color_theme if payload.color_theme is not None else "teal"
    updated = repo.update_color_theme(user.id, new_theme)
    return UserSettingsResponse(color_theme=updated.color_theme)
