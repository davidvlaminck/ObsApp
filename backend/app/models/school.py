from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_demo = Column(Boolean, default=False)
    koepel = Column(String, nullable=True)
    koepel_id = Column(Integer, ForeignKey("koepels.id"), nullable=True)
    address = Column(String, nullable=True)
    postal_code = Column(String, nullable=True)
    city = Column(String, nullable=True)

    users = relationship("User", foreign_keys="User.school_id")
    observations = relationship("Observation", back_populates="school")
    student_observations = relationship("StudentObservation", back_populates="school")
    observation_goals = relationship("ObservationGoal", back_populates="school")
    activities = relationship("Activity", back_populates="school")
    school_years = relationship("SchoolYear", back_populates="school", cascade="all, delete-orphan")
    koepel_ref = relationship("Koepel", back_populates="schools")
    school_goal_domains = relationship("SchoolGoalDomain", back_populates="school")
    addresses = relationship("SchoolAddress", back_populates="school", cascade="all, delete-orphan")


class SchoolAddress(Base):
    __tablename__ = "school_addresses"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    address = Column(String, nullable=False)
    postal_code = Column(String, nullable=True)
    city = Column(String, nullable=True)
    is_head_office = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    school = relationship("School", back_populates="addresses")
