from sqlalchemy.orm import Session

from app.models.goal import Goal
from app.schemas.goal import GoalCreate, GoalUpdate, GoalResponse


class GoalRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, payload: GoalCreate) -> Goal:
        goal = Goal(
            code=payload.code,
            title=payload.title,
            description=payload.description,
            subject=payload.subject,
            level=payload.level,
            domain=payload.domain,
            subdomain=payload.subdomain,
            cluster=payload.cluster,
            goal_type=payload.goal_type,
            doel_soort=payload.doel_soort,
            target_type=payload.target_type,
            parent_goal_id=payload.parent_goal_id,
            vo_code=payload.vo_code,
            vocabulary=payload.vocabulary,
            valid_from=payload.valid_from,
        )
        self.db.add(goal)
        self.db.commit()
        self.db.refresh(goal)
        return goal

    def get_by_id(self, goal_id: int) -> Goal | None:
        return self.db.query(Goal).filter(Goal.id == goal_id).first()

    def get_by_code(self, code: str) -> Goal | None:
        return self.db.query(Goal).filter(Goal.code == code).first()

    def get_all(self, subject: str | None = None, goal_type: str | None = None, level: str | None = None) -> list[Goal]:
        query = self.db.query(Goal)
        if subject:
            query = query.filter(Goal.subject == subject)
        if goal_type:
            query = query.filter(Goal.goal_type == goal_type)
        if level:
            query = query.filter(Goal.level == level)
        return query.order_by(Goal.code).all()

    def update(self, goal_id: int, payload: GoalUpdate) -> Goal | None:
        goal = self.get_by_id(goal_id)
        if not goal:
            return None
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(goal, field, value)
        self.db.commit()
        self.db.refresh(goal)
        return goal

    def delete(self, goal_id: int) -> Goal | None:
        goal = self.get_by_id(goal_id)
        if not goal:
            return None
        self.db.delete(goal)
        self.db.commit()
        return goal

    def bulk_create(self, goals_data: list[dict]) -> list[Goal]:
        goals = []
        for data in goals_data:
            goal = Goal(**data)
            self.db.add(goal)
            goals.append(goal)
        self.db.commit()
        for goal in goals:
            self.db.refresh(goal)
        return goals

    def to_response(self, goal: Goal) -> GoalResponse:
        return GoalResponse(
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
            target_type=goal.target_type,
            parent_goal_id=goal.parent_goal_id,
            vo_code=goal.vo_code,
            vocabulary=goal.vocabulary,
            valid_from=goal.valid_from,
            created_at=goal.created_at,
        )
def get_subjects(self, goal_type: str | None = None) -> list[str]:
    query = self.db.query(Goal.subject).filter(Goal.subject.is_not(None)).distinct()
    if goal_type:
        query = query.filter(Goal.goal_type == goal_type)
    return [row[0] for row in query.order_by(Goal.subject).all() if row[0]]

