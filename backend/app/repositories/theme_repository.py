from sqlalchemy.orm import Session

from app.models.theme import Theme
from app.schemas.theme import ThemeResponse


class ThemeRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, name: str, description: str | None = None) -> Theme:
        theme = Theme(name=name, description=description)
        self.db.add(theme)
        self.db.commit()
        self.db.refresh(theme)
        return theme

    def get_by_id(self, theme_id: int) -> Theme | None:
        return self.db.query(Theme).filter(Theme.id == theme_id).first()

    def get_by_name(self, name: str) -> Theme | None:
        return self.db.query(Theme).filter(Theme.name == name).first()

    def get_all(self) -> list[Theme]:
        return self.db.query(Theme).order_by(Theme.name).all()

    def update(self, theme: Theme, name: str | None = None, description: str | None = None) -> Theme:
        if name is not None:
            theme.name = name
        if description is not None:
            theme.description = description
        self.db.add(theme)
        self.db.commit()
        self.db.refresh(theme)
        return theme

    def delete(self, theme: Theme) -> None:
        self.db.delete(theme)
        self.db.commit()

    def to_response(self, theme: Theme) -> ThemeResponse:
        return ThemeResponse(
            id=theme.id,
            name=theme.name,
            description=theme.description,
            created_at=theme.created_at,
        )
