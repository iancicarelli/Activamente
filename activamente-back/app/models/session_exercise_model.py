import uuid

from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class SessionExercise(Base):
    """Progreso de un ejercicio dentro de una sesión (tabla `session_exercises`)."""

    __tablename__ = "session_exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    exercise_id = Column(String, ForeignKey("exercises.id"), nullable=True)
    routine_exercise_id = Column(UUID(as_uuid=True), ForeignKey("routine_exercises.id", ondelete="SET NULL"), nullable=True)
    series_completed = Column(Integer, nullable=False, default=0)
    reps_completed = Column(Integer, nullable=False, default=0)
    accuracy_score = Column(Float, nullable=True)
    feedback = Column(String, nullable=True)
