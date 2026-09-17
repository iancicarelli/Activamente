import enum
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class SurveyType(str, enum.Enum):
    PRE_SESSION = "PRE_SESSION"
    POST_SESSION = "POST_SESSION"


class Survey(Base):
    """Encuesta PRE o POST de una sesión. Todas las escalas son 1-5 (R-02).
    UNIQUE (session_id, type): una sola PRE y una sola POST por sesión."""

    __tablename__ = "surveys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    type = Column(SAEnum(SurveyType, name="survey_type"), nullable=False)
    pain_level = Column(Integer, nullable=True)
    fatigue_level = Column(Integer, nullable=True)
    stress_level = Column(Integer, nullable=True)
    mood_level = Column(Integer, nullable=True)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
