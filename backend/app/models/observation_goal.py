from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ObservationGoal(Base):
    __tablename__ = "observation_goals"

    SCHOOL_GOALS_SUBJECT = "Schooleigen doelen"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False, index=True)
    domain = Column(String, nullable=True, index=True)
    subdomain = Column(String, nullable=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id", ondelete="SET NULL"), nullable=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    school = relationship("School", back_populates="observation_goals")
    creator = relationship("User", back_populates="observation_goals")
    goal = relationship("Goal", back_populates="observation_goals")
    student_observations = relationship("StudentObservation", back_populates="observation_goal")
    activity_links = relationship("ActivityObservationGoal", back_populates="observation_goal", cascade="all, delete-orphan")
