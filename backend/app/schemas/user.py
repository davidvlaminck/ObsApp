from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str | None = Field(default=None, min_length=8)
    name: str = Field(min_length=1)
    is_active: bool = True
    is_superuser: bool = False
    school_id: int | None = None


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    is_active: bool
    is_superuser: bool
    is_pending: bool = False
    school_id: int | None = None
