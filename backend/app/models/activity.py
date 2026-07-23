from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    theme_id = Column(Integer, ForeignKey("themes.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    school = relationship("School", back_populates="activities")
    theme = relationship("Theme", back_populates="activities")
    observation_goal_links = relationship(
        "ActivityObservationGoal",
        back_populates="activity",
        cascade="all, delete-orphan",
    )


class ActivityObservationGoal(Base):
    __tablename__ = "activity_observation_goals"
    __table_args__ = (UniqueConstraint("activity_id", "observation_goal_id", name="uq_activity_observation_goal"),)

    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True, index=True)
    observation_goal_id = Column(Integer, ForeignKey("observation_goals.id", ondelete="CASCADE"), primary_key=True, index=True)
    label = Column(String(200), nullable=True)
    observe = Column(Boolean, default=True, nullable=False)

    activity = relationship("Activity", back_populates="observation_goal_links")
    observation_goal = relationship("ObservationGoal", back_populates="activity_links")
