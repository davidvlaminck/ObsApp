from datetime import date, datetime

from pydantic import BaseModel, Field


class SchoolCreate(BaseModel):
    name: str = Field(min_length=1)
    slug: str | None = Field(default=None, min_length=1, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    is_active: bool = True


class SchoolResponse(BaseModel):
    id: int
    name: str
    slug: str
    is_active: bool
    created_at: datetime | None = None


class SchoolYearCreate(BaseModel):
    name: str = Field(min_length=1)
    start_date: date
    end_date: date
    is_active: bool = False


class SchoolYearResponse(BaseModel):
    id: int
    school_id: int
    name: str
    start_date: date
    end_date: date
    is_active: bool
    created_at: datetime | None = None


class ClassCreate(BaseModel):
    name: str = Field(min_length=1)
    class_type: str = Field(default="JK", pattern="^(JK|K2|K3)$")


class ClassResponse(BaseModel):
    id: int
    school_year_id: int
    name: str
    class_type: str
    created_at: datetime | None = None


class StudentCreate(BaseModel):
    name: str = Field(min_length=1)


class StudentResponse(BaseModel):
    id: int
    class_id: int
    name: str
    image_path: str | None = None
    created_at: datetime | None = None


class StudentBulkUploadResult(BaseModel):
    total: int
    created: int
    errors: list[str]


class StudentPreviewItem(BaseModel):
    class_name: str
    student_name: str
    row_number: int
    is_valid: bool
    error: str | None = None


class StudentPreviewResult(BaseModel):
    items: list[StudentPreviewItem]
    valid_count: int
    invalid_count: int


class StudentConfirmItem(BaseModel):
    class_name: str
    student_name: str


class StudentConfirmImport(BaseModel):
    items: list[StudentConfirmItem]


class TeacherClassLink(BaseModel):
    teacher_id: int
