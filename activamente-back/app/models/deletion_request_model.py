import uuid

from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base

PENDING = "PENDING"
APPROVED = "APPROVED"
REJECTED = "REJECTED"


class DeletionRequest(Base):
    """Solicitud de un paciente para borrar su cuenta. `user_id` sin FK: la fila sobrevive al
    borrado como constancia de que se atendió."""

    __tablename__ = "deletion_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    status = Column(String, nullable=False, default=PENDING)
    reason = Column(Text, nullable=True)
    requested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
