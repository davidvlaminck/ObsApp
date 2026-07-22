from sqlalchemy import not_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.activity import Activity, ActivityGoal
from app.models.goal import Goal
from app.models.theme import Theme
from app.models.school import School
from app.schemas.activity import ActivityResponse, ActivityGoalResponse


class ActivityRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, school_id: int, name: str, description: str | None, theme_id: int | None, goal_ids: list[int]) -> Activity:
        activity = Activity(
            school_id=school_id,
            name=name,
            description=description,
            theme_id=theme_id,
        )
        self.db.add(activity)
        self.db.commit()
        self.db.refresh(activity)

        if goal_ids:
            goals = self.db.query(Goal).filter(Goal.id.in_(goal_ids)).all()
            activity.goals = goals
            self.db.add(activity)
            self.db.commit()
            self.db.refresh(activity)

        return activity

    def get_by_id(self, activity_id: int, school_id: int) -> Activity | None:
        return (
            self.db.query(Activity)
            .options(joinedload(Activity.theme), selectinload(Activity.goals))
            .filter(Activity.id == activity_id, Activity.school_id == school_id)
            .first()
        )

    def get_all(self, school_id: int, theme_id: int | None = None) -> list[Activity]:
        query = (
            self.db.query(Activity)
            .options(joinedload(Activity.theme), selectinload(Activity.goals))
            .filter(Activity.school_id == school_id)
        )
        if theme_id:
            query = query.filter(Activity.theme_id == theme_id)
        return query.order_by(Activity.created_at.desc()).all()

    def update(self, activity: Activity, name: str | None = None, description: str | None = None, theme_id: int | None = None, goal_ids: list[int] | None = None) -> Activity:
        if name is not None:
            activity.name = name
        if description is not None:
            activity.description = description
        if theme_id is not None:
            activity.theme_id = theme_id

        if goal_ids is not None:
            activity.goals = self.db.query(Goal).filter(Goal.id.in_(goal_ids)).all()

        self.db.add(activity)
        self.db.commit()
        self.db.refresh(activity)
        return activity

    def delete(self, activity: Activity) -> None:
        self.db.delete(activity)
        self.db.commit()

    def to_response(self, activity: Activity) -> ActivityResponse:
        return ActivityResponse(
            id=activity.id,
            school_id=activity.school_id,
            name=activity.name,
            description=activity.description,
            theme_id=activity.theme_id,
            theme=(
                {"id": activity.theme.id, "name": activity.theme.name, "description": activity.theme.description}
                if activity.theme
                else None
            ),
            goals=[
                ActivityGoalResponse(
                    id=goal.id,
                    code=goal.code,
                    title=goal.title,
                    goal_type=goal.goal_type,
                )
                for goal in activity.goals
            ],
            created_at=activity.created_at,
            updated_at=activity.updated_at,
        )

    def delete_goal(self, activity: Activity, goal_id: int) -> None:
        if goal_id in [goal.id for goal in activity.goals]:
            activity.goals = [goal for goal in activity.goals if goal.id != goal_id]
            self.db.add(activity)
            self.db.commit()

    def get_available_goals(self, school_id: int, koepel_slug: str | None) -> list[Goal]:
        query = self.db.query(Goal)
        if koepel_slug == "katholiek-onderwijs-vlaanderen":
            query = query.filter(Goal.goal_type == "OP_STAP")
        else:
            query = query.filter(Goal.goal_type == "VO")
        return query.order_by(Goal.subject, Goal.code).all()
