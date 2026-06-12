from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.observation import Observation
from app.schemas.observation import ObservationCreate, ObservationUpdate, ObservationResponse


class ObservationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, payload: ObservationCreate, school_id: int, created_by: int) -> Observation:
        observation = Observation(
            school_id=school_id,
            created_by=created_by,
            title=payload.title,
            description=payload.description,
            observation_date=payload.observation_date,
        )
        self.db.add(observation)
        self.db.commit()
        self.db.refresh(observation)
        return observation

    def update(self, observation: Observation, payload: ObservationUpdate) -> Observation:
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(observation, field, value)

        self.db.add(observation)
        self.db.commit()
        self.db.refresh(observation)
        return observation

    def get_by_id(self, observation_id: int, school_id: int) -> Observation | None:
        return (
            self.db.query(Observation)
            .filter(Observation.id == observation_id, Observation.school_id == school_id)
            .first()
        )

    def get_all(self, school_id: int) -> list[Observation]:
        return (
            self.db.query(Observation)
            .filter(Observation.school_id == school_id)
            .order_by(desc(Observation.observation_date), desc(Observation.created_at))
            .all()
        )

    def delete(self, observation: Observation) -> None:
        self.db.delete(observation)
        self.db.commit()

    def to_response(self, observation: Observation) -> ObservationResponse:
        return ObservationResponse(
            id=observation.id,
            school_id=observation.school_id,
            created_by=observation.created_by,
            title=observation.title,
            description=observation.description,
            observation_date=observation.observation_date,
            created_at=observation.created_at,
            updated_at=observation.updated_at,
        )
