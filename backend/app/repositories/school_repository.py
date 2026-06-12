import re
from unicodedata import normalize

from sqlalchemy.orm import Session

from app.models.school import School
from app.schemas.school import SchoolResponse


def slugify(value: str) -> str:
    normalized = normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "school"


class SchoolRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, name: str, slug: str | None = None, is_active: bool = True) -> School:
        base_slug = slugify(slug or name)
        candidate_slug = base_slug
        counter = 2

        while self.get_by_slug(candidate_slug):
            candidate_slug = f"{base_slug}-{counter}"
            counter += 1

        school = School(name=name, slug=candidate_slug, is_active=is_active)
        self.db.add(school)
        self.db.commit()
        self.db.refresh(school)
        return school

    def get_by_id(self, school_id: int) -> School | None:
        return self.db.query(School).filter(School.id == school_id).first()

    def get_by_slug(self, slug: str) -> School | None:
        return self.db.query(School).filter(School.slug == slug).first()

    def get_all(self) -> list[School]:
        return self.db.query(School).all()

    def to_response(self, school: School) -> SchoolResponse:
        return SchoolResponse(
            id=school.id,
            name=school.name,
            slug=school.slug,
            is_active=school.is_active,
            created_at=school.created_at,
        )
