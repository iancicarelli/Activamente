import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    SPECIALIST = "SPECIALIST"
    PATIENT = "PATIENT"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String)
    last_name = Column(String)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(SAEnum(UserRole, name="user_role"), nullable=False)
    # Único flag de activo del sistema (R-01): lo togglea el admin o el
    # especialista asignado; login y get_current_user lo rechazan si es False.
    is_active = Column(Boolean, nullable=False, server_default="true", default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def full_name(self) -> str:
        return f"{self.first_name or ''} {self.last_name or ''}".strip()
