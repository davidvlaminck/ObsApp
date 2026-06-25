from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token, get_password_hash, verify_password
from app.models.school import School
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserResponse
from app.schemas.user import UserResponse as UserResponseSchema


class AuthService:
    def __init__(self, db: Session):
        self.user_repo = UserRepository(db)
        self.db = db

    def _needs_koepel_selection(self, user: User) -> bool:
        """Check if user needs to select a koepel for their school."""
        if user.is_superuser:
            return False
        
        # For demo users without a demo_school_id, they need to select a koepel first
        if user.is_demo and not user.demo_school_id:
            return True
        
        # Determine which school to check
        school_id = user.demo_school_id if user.is_demo else user.school_id
        if not school_id:
            return False
        
        # Check if the school exists and has no koepel set
        school = self.db.query(School).filter(School.id == school_id).first()
        if not school:
            return False
        
        return not school.koepel

    def authenticate_user(self, email: str, password: str) -> UserResponseSchema | None:
        user = self.user_repo.get_by_email(email)
        if not user:
            return None
        if user.is_pending or not user.hashed_password:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None
        return self.user_repo.to_response(user, self._needs_koepel_selection(user))

    def get_user_from_token(self, token: str) -> UserResponseSchema | None:
        payload = decode_access_token(token)
        if not payload:
            return None
        email = payload.get("sub")
        if not email:
            return None
        user = self.user_repo.get_by_email(email)
        if not user or user.is_pending or not user.is_active:
            return None
        return self.user_repo.to_response(user, self._needs_koepel_selection(user))

    def create_user(
        self,
        email: str,
        password: str | None,
        name: str,
        is_superuser: bool = False,
        school_id: int | None = None,
        is_active: bool = True,
    ) -> User:
        hashed = get_password_hash(password) if password else None
        is_pending = password is None
        return self.user_repo.create(
            email,
            hashed,
            name,
            is_superuser,
            school_id,
            is_active,
            is_pending,
        )

    def create_demo_user(
        self,
        email: str,
        name: str,
    ) -> User:
        """Create a demo user with a personal demo school."""
        demo_expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.demo_account_expire_days,
        )
        return self.user_repo.create(
            email=email,
            hashed_password=None,
            name=name,
            is_superuser=False,
            school_id=None,
            is_active=True,
            is_pending=True,
            is_demo=True,
            demo_expires_at=demo_expires_at,
            demo_school_id=None,
        )

    def create_activation_token(self, user: User) -> str:
        token = token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.activation_token_expire_hours,
        )
        self.user_repo.db.commit()
        return token

    def _is_activation_expired(self, expires_at: datetime | None) -> bool:
        if not expires_at:
            return True

        stored_expires_at = (
            expires_at.replace(tzinfo=timezone.utc)
            if expires_at.tzinfo is None
            else expires_at.astimezone(timezone.utc)
        )
        return stored_expires_at < datetime.now(timezone.utc)

    def set_password(self, token: str, password: str) -> User:
        user = self.user_repo.get_by_activation_token(token)
        if not user:
            raise ValueError("Ongeldige activatielink")

        if self._is_activation_expired(user.password_reset_expires_at):
            raise ValueError("Activatielink is verlopen")

        user.hashed_password = get_password_hash(password)
        user.password_reset_token = None
        user.password_reset_expires_at = None
        user.is_pending = False
        user.is_active = True
        self.user_repo.db.commit()
        self.user_repo.db.refresh(user)
        return user
