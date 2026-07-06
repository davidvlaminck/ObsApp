from sqlalchemy import and_, desc, or_
from sqlalchemy.orm import Session, joinedload

from app.models.goal import Goal
from app.models.observation_goal import ObservationGoal
from app.models.school_year import Class as ClassModel
from app.models.school_year import SchoolYear as SchoolYearModel
from app.models.school_year import Student as StudentModel
from app.models.student_observation import StudentObservation
from app.repositories.school_year_repository import StudentRepository
from app.repositories.user_repository import UserRepository
from app.schemas.student_observation import (
    StudentObservationCreate,
    StudentObservationResponse,
    StudentObservationStatusResponse,
)
from app.schemas.observation_goal import ObservationGoalResponse


class StudentObservationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self, payload: StudentObservationCreate, school_id: int, observed_by: int
    ) -> StudentObservation:
        observation_goal = self.get_goal_for_school(payload.observation_goal_id, school_id)
        if not observation_goal:
            raise ValueError("Observatiedoel niet gevonden")

        student = self.db.query(StudentModel).filter(StudentModel.id == payload.student_id).first()
        if not student:
            raise ValueError("Leerling niet gevonden")

        class_model = self.db.query(ClassModel).filter(ClassModel.id == student.class_id).first()
        if not class_model or not self._goal_matches_class(
            observation_goal, class_model.class_type
        ):
            raise ValueError("Dit observatiedoel is niet beschikbaar voor deze klas")

        existing = (
            self.db.query(StudentObservation)
            .filter(
                StudentObservation.school_id == school_id,
                StudentObservation.observation_goal_id == observation_goal.id,
                StudentObservation.student_id == student.id,
                StudentObservation.observation_date == payload.observation_date,
            )
            .first()
        )

        if existing:
            existing.status = payload.status
            existing.observation_date = payload.observation_date
            existing.observed_by = observed_by
            if payload.comment:
                existing.comment = payload.comment
            self.db.commit()
            self.db.refresh(existing)
            return self.get_by_id(existing.id, school_id) or existing

        observation = StudentObservation(
            school_id=school_id,
            observation_goal_id=observation_goal.id,
            student_id=student.id,
            observed_by=observed_by,
            status=payload.status,
            observation_date=payload.observation_date,
            comment=payload.comment,
        )
        self.db.add(observation)
        self.db.commit()
        self.db.refresh(observation)
        return self.get_by_id(observation.id, school_id) or observation

    def get_by_id(self, observation_id: int, school_id: int) -> StudentObservation | None:
        return (
            self.db.query(StudentObservation)
            .options(
                joinedload(StudentObservation.observation_goal).joinedload(ObservationGoal.goal),
                joinedload(StudentObservation.student).joinedload(StudentModel.class_),
                joinedload(StudentObservation.observer),
            )
            .filter(
                StudentObservation.id == observation_id, StudentObservation.school_id == school_id
            )
            .first()
        )

    def get_all(self, school_id: int) -> list[StudentObservation]:
        return (
            self.db.query(StudentObservation)
            .filter(StudentObservation.school_id == school_id)
            .order_by(
                desc(StudentObservation.observation_date), desc(StudentObservation.created_at)
            )
            .all()
        )

    def get_latest_statuses_for_students(
        self,
        school_id: int,
        class_id: int,
        observation_goal_id: int | None = None,
    ) -> dict[int, StudentObservationStatusResponse]:
        query = self.db.query(StudentObservation).filter(StudentObservation.school_id == school_id)
        query = query.join(StudentModel, StudentObservation.student_id == StudentModel.id).filter(
            StudentModel.class_id == class_id
        )
        if observation_goal_id:
            query = query.filter(StudentObservation.observation_goal_id == observation_goal_id)

        statuses: dict[int, StudentObservationStatusResponse] = {}
        observations = query.order_by(
            desc(StudentObservation.observation_date),
            desc(StudentObservation.created_at),
            desc(StudentObservation.id),
        ).all()
        for observation in observations:
            statuses.setdefault(observation.student_id, self.to_status_response(observation))
        return statuses

    def to_status_response(
        self, observation: StudentObservation
    ) -> StudentObservationStatusResponse:
        return StudentObservationStatusResponse(
            id=observation.id,
            observation_goal_id=observation.observation_goal_id,
            student_id=observation.student_id,
            status=observation.status,
            observation_date=observation.observation_date,
            comment=observation.comment,
        )

    def delete(self, observation: StudentObservation) -> None:
        self.db.delete(observation)
        self.db.commit()

    def to_response(self, observation: StudentObservation) -> StudentObservationResponse:
        return StudentObservationResponse(
            id=observation.id,
            school_id=observation.school_id,
            observation_goal_id=observation.observation_goal_id,
            student_id=observation.student_id,
            observed_by=observation.observed_by,
            status=observation.status,
            observation_date=observation.observation_date,
            comment=observation.comment,
            created_at=observation.created_at,
            updated_at=observation.updated_at,
            observation_goal=observation.observation_goal,
            student=StudentRepository(self.db).to_response(
                self._get_student(observation.student_id)
            )
            if observation.student_id
            else None,
            observer=UserRepository(self.db).to_response(
                self._get_observer(observation.observed_by)
            )
            if observation.observed_by
            else None,
        )

    def _get_student(self, student_id: int):
        student = self.db.query(StudentModel).filter(StudentModel.id == student_id).first()
        return student

    def _get_observer(self, user_id: int):
        from app.models.user import User

        user = self.db.query(User).filter(User.id == user_id).first()
        return user

    def get_goal_for_school(
        self, observation_goal_id: int, school_id: int
    ) -> ObservationGoal | None:
        return (
            self.db.query(ObservationGoal)
            .options(joinedload(ObservationGoal.goal))
            .filter(
                ObservationGoal.id == observation_goal_id, ObservationGoal.school_id == school_id
            )
            .first()
        )

    def _goal_matches_class(self, observation_goal: ObservationGoal, class_type: str) -> bool:
        if observation_goal.goal and observation_goal.goal.level == class_type:
            return True
        if observation_goal.goal is None and observation_goal.subdomain == class_type:
            return True
        return False

    def get_for_observing(
        self,
        school_id: int,
        class_id: int | None = None,
        subject: str | None = None,
        domain: str | None = None,
        q: str | None = None,
    ) -> list[ObservationGoal]:
        query = self.db.query(ObservationGoal).options(joinedload(ObservationGoal.goal))
        query = query.filter(ObservationGoal.school_id == school_id)

        if class_id:
            class_model = self.db.query(ClassModel).filter(ClassModel.id == class_id).first()
            if class_model:
                query = query.filter(
                    or_(
                        Goal.level == class_model.class_type,
                        and_(
                            ObservationGoal.goal_id.is_(None),
                            ObservationGoal.subdomain == class_model.class_type,
                        ),
                    )
                )

        if subject:
            query = query.filter(ObservationGoal.subject.ilike(subject))
        if domain:
            query = query.filter(ObservationGoal.domain.ilike(domain))
        if q:
            search_term = f"%{q.strip()}%"
            query = query.filter(
                or_(
                    ObservationGoal.name.ilike(search_term),
                    Goal.code.ilike(search_term),
                    Goal.title.ilike(search_term),
                    Goal.description.ilike(search_term),
                )
            )

        return query.order_by(
            ObservationGoal.subject, ObservationGoal.domain, ObservationGoal.name
        ).all()

    def get_overview_data(
        self,
        school_id: int,
        class_id: int,
        subject: str | None = None,
    ) -> tuple[list[ObservationGoal], list[StudentModel], dict[tuple[int, int], StudentObservationStatusResponse]]:
        class_model = self.db.query(ClassModel).filter(ClassModel.id == class_id).first()
        if not class_model:
            return [], [], {}

        school_year = self.db.query(SchoolYearModel).filter(SchoolYearModel.id == class_model.school_year_id).first()
        if not school_year or school_year.school_id != school_id:
            return [], [], {}

        goals_query = self.db.query(ObservationGoal).options(joinedload(ObservationGoal.goal)).filter(
            ObservationGoal.school_id == school_id
        )
        if subject:
            goals_query = goals_query.filter(ObservationGoal.subject.ilike(subject))

        goals_query = goals_query.filter(
            or_(
                Goal.level == class_model.class_type,
                and_(
                    ObservationGoal.goal_id.is_(None),
                    ObservationGoal.subdomain == class_model.class_type,
                ),
            )
        )
        goals = goals_query.order_by(ObservationGoal.subject, ObservationGoal.domain, ObservationGoal.name).all()

        students = (
            self.db.query(StudentModel)
            .filter(StudentModel.class_id == class_id)
            .order_by(StudentModel.name)
            .all()
        )

        observations = (
            self.db.query(StudentObservation)
            .filter(StudentObservation.school_id == school_id)
            .join(StudentModel, StudentObservation.student_id == StudentModel.id)
            .filter(StudentModel.class_id == class_id)
            .order_by(
                desc(StudentObservation.observation_date),
                desc(StudentObservation.created_at),
                desc(StudentObservation.id),
            )
            .all()
        )

        status_map: dict[tuple[int, int], StudentObservationStatusResponse] = {}
        for observation in observations:
            key = (observation.observation_goal_id, observation.student_id)
            if key not in status_map:
                status_map[key] = self.to_status_response(observation)

        return goals, students, status_map
