from sqlalchemy import and_, desc, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.goal import Goal
from app.models.observation_goal import ObservationGoal
from app.models.school_goal_domain import SchoolGoalDomain
from app.models.school_year import Class as ClassModel
from app.schemas.observation_goal import GoalSummary, ObservationGoalCreate, ObservationGoalResponse, ObservationGoalUpdate


class ObservationGoalRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, payload: ObservationGoalCreate, school_id: int, created_by: int) -> ObservationGoal:
        observation_goal = ObservationGoal(
            school_id=school_id,
            created_by=created_by,
            name=payload.name,
            subject=payload.subject,
            domain=payload.domain,
            subdomain=payload.subdomain,
            goal=self._get_opstap_goal(payload.goal_id),
            class_id=payload.class_id,
        )
        self.db.add(observation_goal)
        self.db.commit()
        self.db.refresh(observation_goal)
        return observation_goal

    def update(self, observation_goal: ObservationGoal, payload: ObservationGoalUpdate) -> ObservationGoal:
        update_data = payload.model_dump(exclude_unset=True)
        if "goal_id" in update_data:
            observation_goal.goal = self._get_opstap_goal(update_data["goal_id"])
            update_data.pop("goal_id")

        for field, value in update_data.items():
            setattr(observation_goal, field, value)

        self.db.add(observation_goal)
        self.db.commit()
        self.db.refresh(observation_goal)
        return observation_goal

    def get_by_id(self, observation_goal_id: int, school_id: int) -> ObservationGoal | None:
        return (
            self.db.query(ObservationGoal)
            .options(joinedload(ObservationGoal.goal))
            .filter(
                ObservationGoal.id == observation_goal_id,
                ObservationGoal.school_id == school_id,
            )
            .first()
        )

    def get_all(
        self,
        school_id: int,
        subject: str | None = None,
        domain: str | None = None,
        subdomain: str | None = None,
        q: str | None = None,
        class_id: int | None = None,
    ) -> list[ObservationGoal]:
        query = self.db.query(ObservationGoal).options(joinedload(ObservationGoal.goal))
        query = query.filter(ObservationGoal.school_id == school_id)

        if class_id:
            class_model = self.db.query(ClassModel).filter(ClassModel.id == class_id).first()
            if class_model:
                query = query.outerjoin(ObservationGoal.goal).filter(
                    or_(
                        ObservationGoal.subject == ObservationGoal.SCHOOL_GOALS_SUBJECT,
                        Goal.level == class_model.class_type,
                        and_(ObservationGoal.goal_id.is_(None), ObservationGoal.subdomain == class_model.class_type),
                    )
                )

        if subject:
            query = query.filter(ObservationGoal.subject.ilike(subject))
        if domain:
            query = query.filter(ObservationGoal.domain.ilike(domain))
        if subdomain:
            query = query.filter(ObservationGoal.subdomain.ilike(subdomain))
        if q:
            query = query.filter(ObservationGoal.name.ilike(f"%{q}%"))

        return query.order_by(desc(ObservationGoal.created_at), ObservationGoal.id.desc()).all()

    def get_for_observing(
        self,
        school_id: int,
        class_id: int | None = None,
        subject: str | None = None,
        domain: str | None = None,
        q: str | None = None,
    ) -> list[ObservationGoal]:
        query = self.db.query(ObservationGoal).options(selectinload(ObservationGoal.goal))
        query = query.filter(ObservationGoal.school_id == school_id)

        if class_id:
            class_model = self.db.query(ClassModel).filter(ClassModel.id == class_id).first()
            if class_model:
                query = query.outerjoin(ObservationGoal.goal).filter(
                    or_(
                        ObservationGoal.subject == ObservationGoal.SCHOOL_GOALS_SUBJECT,
                        Goal.level == class_model.class_type,
                        and_(ObservationGoal.goal_id.is_(None), ObservationGoal.subdomain == class_model.class_type),
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

        return query.order_by(ObservationGoal.subject, ObservationGoal.domain, ObservationGoal.name).all()

    def delete(self, observation_goal: ObservationGoal) -> None:
        self.db.delete(observation_goal)
        self.db.commit()

    def get_subjects(self, school_id: int) -> list[str]:
        observation_goal_subjects = {
            row[0]
            for row in self.db.query(ObservationGoal.subject)
            .filter(ObservationGoal.school_id == school_id, ObservationGoal.subject.is_not(None))
            .distinct()
            .all()
        }
        goal_subjects = {
            row[0]
            for row in self.db.query(Goal.subject)
            .filter(Goal.goal_type == "OP_STAP", Goal.subject.is_not(None))
            .distinct()
            .all()
        }
        return sorted(subject for subject in observation_goal_subjects | goal_subjects if subject)

    def get_domains(self, school_id: int, subject: str | None = None) -> list[str]:
        observation_goal_domains = {
            row[0]
            for row in self.db.query(ObservationGoal.domain)
            .filter(ObservationGoal.school_id == school_id, ObservationGoal.domain.is_not(None))
            .distinct()
            .all()
        }
        goal_domain_query = self.db.query(Goal.domain).filter(
            Goal.goal_type == "OP_STAP",
            Goal.domain.is_not(None),
        )
        if subject:
            observation_goal_domains = {
                row[0]
                for row in self.db.query(ObservationGoal.domain)
                .filter(
                    ObservationGoal.school_id == school_id,
                    ObservationGoal.domain.is_not(None),
                    ObservationGoal.subject.ilike(subject),
                )
                .distinct()
                .all()
            }
            goal_domain_query = goal_domain_query.filter(Goal.subject.ilike(subject))
        goal_domains = {row[0] for row in goal_domain_query.distinct().all()}

        managed_domain_names = {
            row[0]
            for row in self.db.query(SchoolGoalDomain.name)
            .filter(SchoolGoalDomain.school_id == school_id)
            .distinct()
            .all()
        }

        if subject:
            managed_domains = {
                row[0]
                for row in self.db.query(ObservationGoal.domain)
                .filter(
                    ObservationGoal.school_id == school_id,
                    ObservationGoal.domain.is_not(None),
                    ObservationGoal.subject.ilike(subject),
                    ObservationGoal.domain.in_(managed_domain_names),
                )
                .distinct()
                .all()
            }
        else:
            managed_domains = managed_domain_names

        return sorted(domain for domain in observation_goal_domains | goal_domains | managed_domains if domain)

    def get_subdomains(self, school_id: int, subject: str | None = None, domain: str | None = None) -> list[str]:
        query = self.db.query(ObservationGoal.subdomain).filter(
            ObservationGoal.school_id == school_id,
            ObservationGoal.subdomain.is_not(None),
        )
        if subject:
            query = query.filter(ObservationGoal.subject.ilike(subject))
        if domain:
            query = query.filter(ObservationGoal.domain.ilike(domain))
        observation_goal_subdomains = {row[0] for row in query.distinct().all()}

        goal_subdomain_query = self.db.query(Goal.subdomain).filter(
            Goal.goal_type == "OP_STAP",
            Goal.subdomain.is_not(None),
        )
        if subject:
            goal_subdomain_query = goal_subdomain_query.filter(Goal.subject.ilike(subject))
        if domain:
            goal_subdomain_query = goal_subdomain_query.filter(Goal.domain.ilike(domain))
        goal_subdomains = {row[0] for row in goal_subdomain_query.distinct().all()}

        return sorted(subdomain for subdomain in observation_goal_subdomains | goal_subdomains if subdomain)

    def count_by_school(self, school_id: int) -> int:
        return (
            self.db.query(ObservationGoal)
            .filter(ObservationGoal.school_id == school_id)
            .count()
        )

    def to_response(self, observation_goal: ObservationGoal) -> ObservationGoalResponse:
        return ObservationGoalResponse(
            id=observation_goal.id,
            school_id=observation_goal.school_id,
            created_by=observation_goal.created_by,
            name=observation_goal.name,
            subject=observation_goal.subject,
            domain=observation_goal.domain,
            subdomain=observation_goal.subdomain,
            goal_id=observation_goal.goal_id,
            class_id=observation_goal.class_id,
            goal=self._goal_summary(observation_goal.goal) if observation_goal.goal else None,
            created_at=observation_goal.created_at,
            updated_at=observation_goal.updated_at,
        )

    def _goal_summary(self, goal: Goal) -> GoalSummary:
        return GoalSummary(
            id=goal.id,
            code=goal.code,
            title=goal.title,
            description=goal.description,
            subject=goal.subject,
            level=goal.level,
            domain=goal.domain,
            subdomain=goal.subdomain,
            cluster=goal.cluster,
            goal_type=goal.goal_type,
            doel_soort=goal.doel_soort,
            vo_code=goal.vo_code,
        )

    def _get_opstap_goal(self, goal_id: int | None) -> Goal | None:
        if goal_id is None:
            return None

        goal = self.db.query(Goal).filter(Goal.id == goal_id, Goal.goal_type == "OP_STAP").first()
        if not goal:
            raise ValueError("Op Stap doel niet gevonden")
        return goal

    def search_goals(
        self,
        subject: str | None = None,
        domain: str | None = None,
        subdomain: str | None = None,
        level: str | None = None,
        q: str | None = None,
    ) -> list[Goal]:
        query = self.db.query(Goal).filter(Goal.goal_type == "OP_STAP")
        if subject:
            query = query.filter(Goal.subject.ilike(subject))
        if domain:
            query = query.filter(Goal.domain.ilike(domain))
        if subdomain:
            query = query.filter(Goal.subdomain.ilike(subdomain))
        if level:
            query = query.filter(Goal.level == level)
        if q and len(q.strip()) >= 2:
            search_term = f"%{q.strip()}%"
            query = query.filter(
                or_(
                    Goal.code.ilike(search_term),
                    Goal.title.ilike(search_term),
                    Goal.description.ilike(search_term),
                    Goal.vo_code.ilike(search_term),
                )
            )
        return query.order_by(Goal.subject, Goal.level, Goal.code).all()

    def update_domain_for_school(self, school_id: int, old_domain: str, new_domain: str) -> int:
        goals = (
            self.db.query(ObservationGoal)
            .filter(
                ObservationGoal.school_id == school_id,
                ObservationGoal.domain == old_domain,
            )
            .all()
        )
        for goal in goals:
            goal.domain = new_domain
        self.db.commit()
        return len(goals)
