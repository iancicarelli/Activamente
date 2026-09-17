import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Session(Base):
    """Una sesión de entrenamiento (tabla `sessions`)."""

    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.user_id", ondelete="CASCADE"), nullable=False)
    routine_id = Column(UUID(as_uuid=True), ForeignKey("routines.id", ondelete="SET NULL"), nullable=True)
    date = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    is_completed = Column(Boolean, nullable=False, default=False, server_default="false")

    session_exercises = relationship(
        "SessionExercise",
        cascade="all, delete-orphan",
        order_by="SessionExercise.id",
    )
    surveys = relationship("Survey", cascade="all, delete-orphan")
