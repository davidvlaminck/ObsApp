from sqlalchemy import not_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.activity import Activity, ActivityObservationGoal
from app.models.goal import Goal
from app.models.observation_goal import ObservationGoal
from app.models.theme import Theme
from app.models.school import School
from app.schemas.activity import ActivityResponse, ActivityGoalResponse


class ActivityRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, school_id: int, name: str, description: str | None, theme_id: int, goal_items: list[dict], created_by: int | None = None) -> Activity:
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
            self._sync_observation_goal_links(activity, goal_items, created_by)

        return activity

    def get_by_id(self, activity_id: int, school_id: int) -> Activity | None:
        return (
            self.db.query(Activity)
            .options(
                joinedload(Activity.theme),
                selectinload(Activity.observation_goal_links).selectinload(ActivityObservationGoal.observation_goal),
            )
            .filter(Activity.id == activity_id, Activity.school_id == school_id)
            .first()
        )

    def get_all(self, school_id: int, theme_id: int | None = None) -> list[Activity]:
        query = (
            self.db.query(Activity)
            .options(
                joinedload(Activity.theme),
                selectinload(Activity.observation_goal_links).selectinload(ActivityObservationGoal.observation_goal),
            )
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
            self._sync_observation_goal_links(activity, goal_items, created_by)

        self.db.add(activity)
        self.db.commit()
        self.db.refresh(activity)
        return activity

    def delete(self, activity: Activity) -> None:
        self.db.delete(activity)
        self.db.commit()

    def to_response(self, activity: Activity) -> ActivityResponse:
        goals = []
        for link in activity.observation_goal_links:
            observation_goal = link.observation_goal
            goal = observation_goal.goal if observation_goal else None
            goals.append(
                ActivityGoalResponse(
                    id=observation_goal.id if observation_goal else 0,
                    goal_id=goal.id if goal else None,
                    label=link.label or (observation_goal.name if observation_goal else None),
                    observe=link.observe,
                    code=goal.code if goal else None,
                    title=goal.title if goal else None,
                    goal_type=goal.goal_type if goal else None,
                )
            )

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

    def delete_observation_goal_link(self, activity: Activity, observation_goal_id: int) -> None:
        link = self.db.query(ActivityObservationGoal).filter(
            ActivityObservationGoal.activity_id == activity.id,
            ActivityObservationGoal.observation_goal_id == observation_goal_id,
        ).first()
        if link:
            self.db.delete(link)
            self.db.commit()

    def get_available_goals(self, school_id: int, koepel_slug: str | None) -> list[Goal]:
        query = self.db.query(Goal)
        if koepel_slug == "katholiek-onderwijs-vlaanderen":
            query = query.filter(Goal.goal_type == "OP_STAP")
        else:
            query = query.filter(Goal.goal_type == "VO")
        return query.order_by(Goal.subject, Goal.code).all()

    def _find_or_create_observation_goal(self, school_id: int, created_by: int | None, goal: Goal, label: str | None) -> ObservationGoal:
        name = label or goal.title
        observation_goal = (
            self.db.query(ObservationGoal)
            .filter(
                ObservationGoal.school_id == school_id,
                ObservationGoal.goal_id == goal.id,
                ObservationGoal.name == name,
            )
            .first()
        )
        if observation_goal:
            return observation_goal

        observation_goal = ObservationGoal(
            school_id=school_id,
            created_by=created_by or 0,
            name=name,
            subject=goal.subject,
            domain=goal.domain,
            subdomain=goal.subdomain,
            goal_id=goal.id,
        )
        self.db.add(observation_goal)
        self.db.commit()
        self.db.refresh(observation_goal)
        return observation_goal

    def _sync_observation_goal_links(self, activity: Activity, goal_items: list[dict], created_by: int | None = None) -> None:
        current_observation_goal_ids = set()
        existing_links = {
            link.observation_goal_id: link
            for link in self.db.query(ActivityObservationGoal)
            .filter(ActivityObservationGoal.activity_id == activity.id)
            .all()
        }

        for item in goal_items:
            goal = self.db.query(Goal).filter(Goal.id == item["goal_id"]).first()
            if not goal:
                continue

            observation_goal = self._find_or_create_observation_goal(
                activity.school_id,
                created_by,
                goal,
                item.get("label"),
            )

            current_observation_goal_ids.add(observation_goal.id)
            existing_link = existing_links.get(observation_goal.id)
            if existing_link:
                existing_link.label = item.get("label") or goal.title
                existing_link.observe = item.get("observe", False)
            else:
                link = ActivityObservationGoal(
                    activity_id=activity.id,
                    observation_goal_id=observation_goal.id,
                    label=item.get("label") or goal.title,
                    observe=item.get("observe", False),
                )
                self.db.add(link)

        for og_id, link in existing_links.items():
            if og_id not in current_observation_goal_ids:
                self.db.delete(link)

        self.db.commit()
