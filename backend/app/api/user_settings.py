import json
import re

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.core.database import get_db
from app.repositories.user_repository import DEFAULT_STATUS_COLORS, UserRepository
from app.schemas.user import UserResponse, UserSettingsResponse, UserSettingsUpdate

router = APIRouter(prefix="/user-settings", tags=["user-settings"])

VALID_COLOR_THEMES = {"teal", "ocean", "forest", "sunset", "purple"}
VALID_STATUS_KEYS = {"onvoldoende", "in_ontwikkeling", "voldoende", "voorsprong"}
HEX_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")


def _validate_hex_color(value: str) -> bool:
    return bool(HEX_COLOR_PATTERN.match(value))


@router.get("", response_model=UserSettingsResponse)
@router.get("/", response_model=UserSettingsResponse)
def get_user_settings(
    current_user: UserResponse = Depends(get_current_user),
    db=Depends(get_db),
):
    user = UserRepository(db).get_by_id(current_user.id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gebruiker niet gevonden")
    return UserSettingsResponse(
        color_theme=user.color_theme or "teal",
        status_colors=UserRepository(db)._parse_status_colors(user),
    )


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
    user = repo.update_color_theme(user.id, new_theme)

    if payload.status_colors is not None:
        invalid = [key for key in payload.status_colors if key not in VALID_STATUS_KEYS]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ongeldige status sleutels: {', '.join(sorted(invalid))}. Geldige sleutels: {', '.join(sorted(VALID_STATUS_KEYS))}",
            )
        for key, value in payload.status_colors.items():
            if not _validate_hex_color(value):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ongeldige kleurcode voor '{key}': '{value}'. Gebruik een hex code zoals #RRGGBB.",
                )
        merged = {**DEFAULT_STATUS_COLORS, **payload.status_colors}
        user = repo.update_status_colors(user.id, merged)

    return UserSettingsResponse(
        color_theme=user.color_theme,
        status_colors=repo._parse_status_colors(user),
    )
