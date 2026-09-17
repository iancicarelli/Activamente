"""GET /api/me: perfil genérico por rol (EP-14 / HC-03)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.user_model import UserRole


class SpecialistSummary(BaseModel):
    id: UUID
    full_name: str
    specialty: str | None = None
    phone: str | None = None
    email: str


class MePatient(BaseModel):
    rut: str | None = None
    age: int | None = None
    gender: str | None = None
    phone: str | None = None
    address: str | None = None
    specialists: list[SpecialistSummary] = []


class MeSpecialist(BaseModel):
    rut: str | None = None
    specialty: str | None = None
    phone: str | None = None
    total_patients: int = 0


class MeAdmin(BaseModel):
    job_title: str | None = None
    phone: str | None = None


class MeResponse(BaseModel):
    id: UUID
    first_name: str | None = None
    last_name: str | None = None
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime | None = None
    patient: MePatient | None = None
    specialist: MeSpecialist | None = None
    admin: MeAdmin | None = None
