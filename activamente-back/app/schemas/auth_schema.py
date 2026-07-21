from uuid import UUID
from pydantic import BaseModel, EmailStr, Field
from app.models.user_model import UserRole
from typing import Optional
from app.schemas.patient_schema import PatientResponse


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: UUID
    patient: Optional[PatientResponse] = None


class TokenPayload(BaseModel):
    sub: str        # user UUID as string
    role: UserRole
