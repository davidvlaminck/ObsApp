from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class StudentObservation(Base):
    __tablename__ = "student_observations"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, index=True)
    observation_goal_id = Column(Integer, ForeignKey("observation_goals.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    observed_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(32), nullable=False, index=True)
    observation_date = Column(Date, nullable=False, index=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint(
            "student_id", "observation_goal_id", "observation_date",
            name="uq_student_goal_date"
        ),
    )

    school = relationship("School", back_populates="student_observations")
    observation_goal = relationship("ObservationGoal", back_populates="student_observations")
    student = relationship("Student", back_populates="student_observations")
    observer = relationship("User", back_populates="student_observations")
