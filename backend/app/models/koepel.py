from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class Koepel(Base):
    __tablename__ = "koepels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True)

    schools = relationship("School", back_populates="koepel_ref")
    goals = relationship("Goal", back_populates="koepel")
