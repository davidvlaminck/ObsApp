from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserResponse


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
    ) -> User:
        user = User(
            email=email,
            hashed_password=hashed_password,
            name=name,
            is_superuser=is_superuser,
            school_id=school_id,
            is_active=is_active,
            is_pending=is_pending,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_all(self) -> list[User]:
        return self.db.query(User).all()

    def to_response(self, user: User) -> UserResponse:
        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
            is_pending=user.is_pending,
            school_id=user.school_id,
        )
