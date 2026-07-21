from sqlalchemy import Column, Integer, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True))
    routine_id = Column(UUID(as_uuid=True))
    date = Column(DateTime, server_default=func.now())
    duration_minutes = Column(Integer)
    is_completed = Column(Boolean, default=False)
