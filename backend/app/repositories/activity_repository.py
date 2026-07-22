from sqlalchemy import not_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.activity import Activity, ActivityGoal
from app.models.goal import Goal
from app.models.observation_goal import ObservationGoal
from app.models.theme import Theme
from app.models.school import School
from app.schemas.activity import ActivityResponse, ActivityGoalResponse


class ActivityRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, school_id: int, name: str, description: str | None, theme_id: int | None, goal_items: list[dict], created_by: int | None = None) -> Activity:
        activity = Activity(
            school_id=school_id,
            name=name,
            description=description,
            theme_id=theme_id,
        )
        self.db.add(activity)
        self.db.commit()
        self.db.refresh(activity)

        if goal_items:
            self._sync_goal_items(activity, goal_items, created_by)

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

    def update(self, activity: Activity, name: str | None = None, description: str | None = None, theme_id: int | None = None, goal_items: list[dict] | None = None, created_by: int | None = None) -> Activity:
        if name is not None:
            activity.name = name
        if description is not None:
            activity.description = description
        if theme_id is not None:
            activity.theme_id = theme_id

        if goal_items is not None:
            self._sync_goal_items(activity, goal_items, created_by)

        self.db.add(activity)
        self.db.commit()
        self.db.refresh(activity)
        return activity

    def delete(self, activity: Activity) -> None:
        self.db.delete(activity)
        self.db.commit()

    def to_response(self, activity: Activity) -> ActivityResponse:
        goal_labels = {
            ag.goal_id: ag.label
            for ag in self.db.query(ActivityGoal)
            .filter(ActivityGoal.activity_id == activity.id)
            .all()
        }
        goals = [
            ActivityGoalResponse(
                id=goal.id,
                code=goal.code,
                title=goal.title,
                goal_type=goal.goal_type,
                label=goal_labels.get(goal.id),
            )
            for goal in activity.goals
        ]

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
            goals=goals,
            created_at=activity.created_at,
            updated_at=activity.updated_at,
        )

    def delete_goal(self, activity: Activity, goal_id: int) -> None:
        existing = self.db.query(ActivityGoal).filter(
            ActivityGoal.activity_id == activity.id,
            ActivityGoal.goal_id == goal_id,
        ).first()
        if existing:
            self.db.delete(existing)
            self.db.commit()

    def get_available_goals(self, school_id: int, koepel_slug: str | None) -> list[Goal]:
        query = self.db.query(Goal)
        if koepel_slug == "katholiek-onderwijs-vlaanderen":
            query = query.filter(Goal.goal_type == "OP_STAP")
        else:
            query = query.filter(Goal.goal_type == "VO")
        return query.order_by(Goal.subject, Goal.code).all()

    def _sync_goal_items(self, activity: Activity, goal_items: list[dict], created_by: int | None = None) -> None:
        current_ids = {item["goal_id"] for item in goal_items if item.get("goal_id")}
        existing_items = {ag.goal_id: ag for ag in self.db.query(ActivityGoal).filter(ActivityGoal.activity_id == activity.id).all()}

        for goal_id in existing_items.keys() - current_ids:
            self.db.delete(existing_items[goal_id])

        for item in goal_items:
            goal = self.db.query(Goal).filter(Goal.id == item["goal_id"]).first()
            if not goal:
                continue

            existing = existing_items.get(goal.id)
            if existing:
                existing.label = item.get("label") or goal.title
            else:
                ag = ActivityGoal(
                    activity_id=activity.id,
                    goal_id=goal.id,
                    label=item.get("label") or goal.title,
                )
                self.db.add(ag)

            if item.get("observe") and created_by is not None:
                existing_og = self.db.query(ObservationGoal).filter(
                    ObservationGoal.school_id == activity.school_id,
                    ObservationGoal.goal_id == goal.id,
                    ObservationGoal.name == (item.get("label") or goal.title),
                ).first()
                if not existing_og:
                    og = ObservationGoal(
                        school_id=activity.school_id,
                        created_by=created_by,
                        name=item.get("label") or goal.title,
                        subject=goal.subject,
                        domain=goal.domain,
                        subdomain=goal.subdomain,
                        goal_id=goal.id,
                    )
                    self.db.add(og)

        self.db.commit()
