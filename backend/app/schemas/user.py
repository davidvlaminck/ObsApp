from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str | None = Field(default=None, min_length=8)
    name: str = Field(min_length=1)
    is_active: bool = True
    is_superuser: bool = False
    school_id: int | None = None
    is_demo: bool = False
    koepel: str | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    is_active: bool
    is_superuser: bool
    is_pending: bool = False
    school_id: int | None = None
    is_demo: bool = False
    demo_school_id: int | None = None
    demo_expires_at: datetime | None = None
    default_class_id: int | None = None
    color_theme: str = "teal"
    needs_koepel_selection: bool = False
    status_colors: dict[str, str] | None = None


class UserSettingsResponse(BaseModel):
    color_theme: str = "teal"
    status_colors: dict[str, str] | None = None

    class Config:
        from_attributes = True


class UserSettingsUpdate(BaseModel):
    color_theme: str | None = Field(default=None, min_length=1, max_length=50)
    status_colors: dict[str, str] | None = Field(default=None)
