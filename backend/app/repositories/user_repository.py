import json

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserResponse


DEFAULT_STATUS_COLORS: dict[str, str] = {
    "onvoldoende": "#ef5350",
    "in_ontwikkeling": "#ff9800",
    "voldoende": "#66bb6a",
    "voorsprong": "#42a5f5",
}


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_activation_token(self, token: str) -> User | None:
        return self.db.query(User).filter(User.password_reset_token == token).first()

    def create(
        self,
        email: str,
        hashed_password: str | None,
        name: str,
        is_superuser: bool = False,
        school_id: int | None = None,
        is_active: bool = True,
        is_pending: bool = False,
        is_demo: bool = False,
        demo_expires_at: datetime | None = None,
        demo_school_id: int | None = None,
    ) -> User:
        user = User(
            email=email,
            hashed_password=hashed_password,
            name=name,
            is_superuser=is_superuser,
            school_id=school_id,
            is_active=is_active,
            is_pending=is_pending,
            is_demo=is_demo,
            demo_expires_at=demo_expires_at,
            demo_school_id=demo_school_id,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_all(self) -> list[User]:
        return self.db.query(User).all()

    def get_pending_members(self, school_id: int) -> list[User]:
        return (
            self.db.query(User)
            .filter(User.membership_pending, User.pending_school_id == school_id, User.pending_koepel.isnot(None))
            .all()
        )

    def _parse_status_colors(self, user: User) -> dict[str, str] | None:
        if not user.status_colors:
            return None
        try:
            return json.loads(user.status_colors)
        except (json.JSONDecodeError, TypeError):
            return None

    def to_response(self, user: User, needs_koepel_selection: bool = False) -> UserResponse:
        effective_school_id = user.demo_school_id if user.is_demo else user.school_id
        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
            is_pending=user.is_pending,
            school_id=effective_school_id,
            is_demo=user.is_demo,
            demo_school_id=user.demo_school_id,
            demo_expires_at=user.demo_expires_at,
            default_class_id=user.default_class_id,
            color_theme=user.color_theme or "teal",
            needs_koepel_selection=needs_koepel_selection,
            status_colors=self._parse_status_colors(user),
            membership_pending=user.membership_pending,
            pending_koepel=user.pending_koepel,
            pending_school_id=user.pending_school_id,
        )

    def update_color_theme(self, user_id: int, color_theme: str) -> User:
        user = self.get_by_id(user_id)
        if not user:
            raise ValueError("Gebruiker niet gevonden")
        user.color_theme = color_theme
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_status_colors(self, user_id: int, status_colors: dict[str, str] | None) -> User:
        user = self.get_by_id(user_id)
        if not user:
            raise ValueError("Gebruiker niet gevonden")
        user.status_colors = json.dumps(status_colors) if status_colors else None
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
