from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
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
    goals = relationship("Goal", secondary="activity_goals", back_populates="activities")


class ActivityGoal(Base):
    __tablename__ = "activity_goals"
    __table_args__ = (UniqueConstraint("activity_id", "goal_id", name="uq_activity_goal"),)

    activity_id = Column(Integer, ForeignKey("activities.id", ondelete="CASCADE"), primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id", ondelete="CASCADE"), primary_key=True, index=True)
