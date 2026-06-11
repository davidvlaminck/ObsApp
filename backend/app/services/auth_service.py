from sqlalchemy.orm import Session

from app.core.security import decode_access_token, get_password_hash, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserResponse


class AuthService:
    def __init__(self, db: Session):
        self.user_repo = UserRepository(db)

    def authenticate_user(self, email: str, password: str) -> UserResponse | None:
        user = self.user_repo.get_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None
        return self.user_repo.to_response(user)

    def get_user_from_token(self, token: str) -> UserResponse | None:
        payload = decode_access_token(token)
        if not payload:
            return None
        email = payload.get("sub")
        if not email:
            return None
        user = self.user_repo.get_by_email(email)
        if not user or not user.is_active:
            return None
        return self.user_repo.to_response(user)

    def create_user(self, email: str, password: str, name: str, is_superuser: bool = False) -> User:
        hashed = get_password_hash(password)
        return self.user_repo.create(email, hashed, name, is_superuser)
