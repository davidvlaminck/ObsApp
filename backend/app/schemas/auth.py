from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    school_id: int | None = None
