from pydantic import BaseModel, EmailStr
from datetime import datetime, date
from typing import Optional


class UserRegister(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    email: EmailStr
    phone_number: str
    birthdate: Optional[date] = None
    sex: Optional[str] = None
    address: Optional[str] = None
    password: str
    is_minor: bool = False
    guardian_name: Optional[str] = None
    guardian_relationship: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    first_name: str
    middle_name: Optional[str]
    last_name: str
    email: str
    phone_number: str
    birthdate: Optional[date]
    sex: Optional[str]
    address: Optional[str]
    is_verified: bool
    is_minor: bool
    guardian_name: Optional[str]
    guardian_relationship: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    address: Optional[str] = None
    phone_number: Optional[str] = None
    birthdate: Optional[date] = None
    sex: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
