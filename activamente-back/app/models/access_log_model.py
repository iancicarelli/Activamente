from sqlalchemy import BigInteger, Boolean, Column, DateTime, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base
from app.models.user_model import UserRole


class AccessLog(Base):
    """Acceso (o intento denegado) de un admin/especialista a datos de un paciente.
    Sin FKs: el registro sobrevive a la eliminación de usuarios."""

    __tablename__ = "access_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=False)
    actor_role = Column(SAEnum(UserRole, name="user_role", create_type=False), nullable=False)
    patient_id = Column(UUID(as_uuid=True), nullable=True)
    method = Column(String, nullable=False)
    path = Column(String, nullable=False)
    allowed = Column(Boolean, nullable=False)
