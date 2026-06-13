from datetime import date
from sqlalchemy.orm import Session

from app.models.school import School
from app.models.school_year import SchoolYear
from app.schemas.school import ClassResponse, SchoolYearResponse



class SchoolYearRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, school_id: int, name: str, start_date: date, end_date: date, is_active: bool = False) -> SchoolYear:
        school_year = SchoolYear(
            school_id=school_id,
            name=name,
            start_date=start_date,
            end_date=end_date,
            is_active=is_active,
        )
        self.db.add(school_year)
        self.db.commit()
        self.db.refresh(school_year)
        return school_year

    def get_by_id(self, school_year_id: int) -> SchoolYear | None:
        return self.db.query(SchoolYear).filter(SchoolYear.id == school_year_id).first()

    def get_by_school(self, school_id: int) -> list[SchoolYear]:
        return self.db.query(SchoolYear).filter(SchoolYear.school_id == school_id).order_by(SchoolYear.start_date.desc()).all()

    def get_active_by_school(self, school_id: int) -> SchoolYear | None:
        return self.db.query(SchoolYear).filter(SchoolYear.school_id == school_id, SchoolYear.is_active.is_(True)).first()

    def set_active(self, school_year_id: int) -> SchoolYear:
        school_year = self.get_by_id(school_year_id)
        if not school_year:
            raise ValueError("Schooljaar niet gevonden")
        self.db.query(SchoolYear).filter(SchoolYear.school_id == school_year.school_id).update({"is_active": False})
        school_year.is_active = True
        self.db.commit()
        self.db.refresh(school_year)
        return school_year

    def to_response(self, school_year: SchoolYear) -> SchoolYearResponse:
        return SchoolYearResponse(
            id=school_year.id,
            school_id=school_year.school_id,
            name=school_year.name,
            start_date=school_year.start_date,
            end_date=school_year.end_date,
            is_active=school_year.is_active,
            created_at=school_year.created_at,
        )


class ClassRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_class(self, school_year_id: int, name: str):
        from app.models.school_year import Class as ClassModel

        class_model = ClassModel(school_year_id=school_year_id, name=name)
        self.db.add(class_model)
        self.db.commit()
        self.db.refresh(class_model)
        return class_model

    def get_class_by_id(self, class_id: int):
        from app.models.school_year import Class as ClassModel

        return self.db.query(ClassModel).filter(ClassModel.id == class_id).first()

    def get_classes_by_school_year(self, school_year_id: int):
        from app.models.school_year import Class as ClassModel

        return self.db.query(ClassModel).filter(ClassModel.school_year_id == school_year_id).order_by(ClassModel.name).all()

    def class_to_response(self, class_model) -> ClassResponse:
        return ClassResponse(
            id=class_model.id,
            school_year_id=class_model.school_year_id,
            name=class_model.name,
            created_at=class_model.created_at,
        )
