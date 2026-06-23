from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_demo = Column(Boolean, default=False)
    koepel = Column(String, nullable=True)

    users = relationship("User", foreign_keys="User.school_id")
    observations = relationship("Observation", back_populates="school")
    student_observations = relationship("StudentObservation", back_populates="school")
    observation_goals = relationship("ObservationGoal", back_populates="school")
    school_years = relationship("SchoolYear", back_populates="school", cascade="all, delete-orphan")
