import uuid
from sqlalchemy import Column, String, Integer, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    rut = Column(String, unique=True, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
