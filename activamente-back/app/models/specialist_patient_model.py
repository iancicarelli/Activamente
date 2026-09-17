from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class SpecialistPatient(Base):
    """Asignación N:M especialista ↔ paciente. Ambos ids son users.id."""

    __tablename__ = "specialist_patient"

    specialist_id = Column(UUID(as_uuid=True), ForeignKey("specialists.user_id", ondelete="CASCADE"), primary_key=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.user_id", ondelete="CASCADE"), primary_key=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
