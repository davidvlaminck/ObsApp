from sqlalchemy.orm import Session

from app.models.school_goal_domain import SchoolGoalDomain
from app.schemas.school_goal_domain import SchoolGoalDomainCreate, SchoolGoalDomainResponse, SchoolGoalDomainUpdate


class SchoolGoalDomainRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, payload: SchoolGoalDomainCreate, school_id: int) -> SchoolGoalDomain:
        domain = SchoolGoalDomain(
            school_id=school_id,
            name=payload.name.strip(),
        )
        self.db.add(domain)
        self.db.commit()
        self.db.refresh(domain)
        return domain

    def get_by_id(self, domain_id: int, school_id: int) -> SchoolGoalDomain | None:
        return (
            self.db.query(SchoolGoalDomain)
            .filter(SchoolGoalDomain.id == domain_id, SchoolGoalDomain.school_id == school_id)
            .first()
        )

    def get_all(self, school_id: int) -> list[SchoolGoalDomain]:
        return (
            self.db.query(SchoolGoalDomain)
            .filter(SchoolGoalDomain.school_id == school_id)
            .order_by(SchoolGoalDomain.name)
            .all()
        )

    def update(self, domain: SchoolGoalDomain, payload: SchoolGoalDomainUpdate) -> SchoolGoalDomain:
        domain.name = payload.name.strip()
        self.db.add(domain)
        self.db.commit()
        self.db.refresh(domain)
        return domain

    def delete(self, domain: SchoolGoalDomain) -> None:
        self.db.delete(domain)
        self.db.commit()

    def to_response(self, domain: SchoolGoalDomain) -> SchoolGoalDomainResponse:
        return SchoolGoalDomainResponse(
            id=domain.id,
            school_id=domain.school_id,
            name=domain.name,
            created_at=domain.created_at,
        )
