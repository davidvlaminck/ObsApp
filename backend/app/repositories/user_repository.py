from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.auth import UserResponse


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email).first()

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def create(self, email: str, hashed_password: str, name: str, is_superuser: bool = False) -> User:
        user = User(
            email=email,
            hashed_password=hashed_password,
            name=name,
            is_superuser=is_superuser,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_all(self) -> list[User]:
        return self.db.query(User).all()

    def to_response(self, user: User) -> UserResponse:
        return UserResponse(id=user.id, email=user.email, name=user.name)
