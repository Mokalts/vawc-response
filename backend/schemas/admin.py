from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List


class AdminCreate(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    email: EmailStr
    phone_number: str
    username: str
    position: str = "Admin"
    password: str


class AdminLogin(BaseModel):
    username: str
    password: str


class AdminFaceEnroll(BaseModel):
    descriptor: List[float]


class AdminFaceVerify(BaseModel):
    descriptor: List[float]


class AdminResponse(BaseModel):
    id: int
    first_name: str
    middle_name: Optional[str]
    last_name: str
    email: str
    phone_number: str
    employee_id: str
    username: str
    position: str
    is_super_admin: bool = False
    is_face_enrolled: bool
    is_active: bool
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminResponse
    needs_face_enrollment: bool = False
    needs_face_verification: bool = False
