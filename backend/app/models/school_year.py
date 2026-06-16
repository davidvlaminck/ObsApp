from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class SchoolYear(Base):
    __tablename__ = "school_years"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    school = relationship("School", back_populates="school_years")
    classes = relationship("Class", back_populates="school_year", cascade="all, delete-orphan")


teacher_class_association = Table(
    "teacher_classes",
    Base.metadata,
    Column("teacher_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("class_id", Integer, ForeignKey("classes.id"), primary_key=True),
)


class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    school_year_id = Column(Integer, ForeignKey("school_years.id"), nullable=False)
    name = Column(String, nullable=False)
    class_type = Column(String, nullable=False, default="JK")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    school_year = relationship("SchoolYear", back_populates="classes")
    students = relationship("Student", back_populates="class_", cascade="all, delete-orphan", lazy="selectin")
    teachers = relationship("User", secondary=teacher_class_association, back_populates="classes")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    name = Column(String, nullable=False)
    image_path = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class_ = relationship("Class", back_populates="students")
    student_observations = relationship("StudentObservation", back_populates="student")
