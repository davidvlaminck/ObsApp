from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    is_pending = Column(Boolean, default=False)
    password_reset_token = Column(String, nullable=True)
    password_reset_expires_at = Column(DateTime(timezone=True), nullable=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=True)
    is_demo = Column(Boolean, default=False)
    demo_expires_at = Column(DateTime(timezone=True), nullable=True)
    demo_school_id = Column(Integer, ForeignKey("schools.id"), nullable=True)

    school = relationship("School", back_populates="users", foreign_keys=[school_id])
    demo_school = relationship("School", foreign_keys=[demo_school_id])
    observations = relationship("Observation", back_populates="creator")
    student_observations = relationship("StudentObservation", back_populates="observer")
    observation_goals = relationship("ObservationGoal", back_populates="creator")
    classes = relationship("Class", secondary="teacher_classes", back_populates="teachers")
