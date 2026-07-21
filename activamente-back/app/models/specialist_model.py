import uuid
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Specialist(Base):
    __tablename__ = "specialists"

    id = Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    rut = Column(String, unique=True, nullable=True)
    specialty = Column(String, nullable=True)
    phone = Column(String, nullable=True)
