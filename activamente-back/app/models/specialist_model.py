from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Specialist(Base):
    """1:1 con users. La PK es user_id: "specialist_id" ES users.id."""

    __tablename__ = "specialists"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    rut = Column(String, unique=True, nullable=True)
    specialty = Column(String, nullable=True)
    phone = Column(String, nullable=True)
