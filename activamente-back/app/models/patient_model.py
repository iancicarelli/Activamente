from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Patient(Base):
    """1:1 con users. La PK es user_id: en todo el código "patient_id" ES users.id."""

    __tablename__ = "patients"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    rut = Column(String, unique=True, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
