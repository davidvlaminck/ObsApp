from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    needs_koepel_selection: bool = False


class SetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)


class KoepelResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_active: bool

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    school_id: int | None = None
    needs_koepel_selection: bool = False
