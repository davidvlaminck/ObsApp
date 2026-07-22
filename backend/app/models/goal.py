from sqlalchemy import Column, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String, nullable=False, index=True)
    level = Column(String, nullable=True, index=True)
    domain = Column(String, nullable=True, index=True)
    subdomain = Column(String, nullable=True, index=True)
    cluster = Column(String, nullable=True, index=True)
    goal_type = Column(String, nullable=False, index=True)  # "VO" or "OP_STAP"
    doel_soort = Column(String, nullable=True, index=True)  # "P", "G", "S", "A", "MD", "+" (alleen Op Stap)
    target_type = Column(String, nullable=True, index=True)  # "NA_TE_STREVEN" of "TE_BEREIKEN" (alleen VO)
    parent_goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    koepel_id = Column(Integer, ForeignKey("koepels.id"), nullable=True, index=True)
    vo_code = Column(String, nullable=True, index=True)
    minimum_goal_code = Column(String, nullable=True, index=True)  # Code van het minimumdoel (alleen Op Stap)
    voorbeelden = Column(Text, nullable=True)  # Voorbeelden uit de beschrijving (alleen Op Stap)
    vocabulary = Column(Text, nullable=True)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent_goal = relationship("Goal", remote_side=[id], back_populates="children")
    children = relationship("Goal", back_populates="parent_goal")
    koepel = relationship("Koepel", back_populates="goals")
    observation_goals = relationship("ObservationGoal", back_populates="goal")
    activities = relationship("Activity", secondary="activity_goals", back_populates="goals")
