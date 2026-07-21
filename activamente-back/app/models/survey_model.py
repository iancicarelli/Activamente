from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base

class Survey(Base):
    __tablename__ = "surveys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"))
    type = Column(String)
    pain_level = Column(Integer)
    fatigue_level = Column(Integer)
    comments = Column(Text)
