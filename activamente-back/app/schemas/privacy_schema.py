"""Términos de uso, solicitudes de eliminación y registro de accesos (Ley 21.719)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.user_model import UserRole


class TermsSection(BaseModel):
    title: str
    body: str


class TermsStatus(BaseModel):
    version: str
    accepted: bool
    accepted_at: datetime | None = None
    sections: list[TermsSection]


class AcceptTermsRequest(BaseModel):
    version: str = Field(min_length=1, max_length=40)


class DeletionRequestCreate(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)


class DeletionRequestOut(BaseModel):
    id: UUID
    status: str
    requested_at: datetime
    resolved_at: datetime | None = None


class DeletionRequestAdminItem(DeletionRequestOut):
    user_id: UUID
    reason: str | None = None
    # Datos del paciente mientras exista (tras aprobar ya no hay a quién nombrar).
    full_name: str | None = None
    email: str | None = None
    rut: str | None = None


class AccessLogItem(BaseModel):
    id: int
    at: datetime
    actor_id: UUID
    actor_name: str | None = None  # None si el usuario ya no existe
    actor_role: UserRole
    patient_id: UUID | None = None
    method: str
    path: str
    allowed: bool
