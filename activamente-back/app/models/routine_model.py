import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Time
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Routine(Base):
    __tablename__ = "routines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    specialist_id = Column(UUID(as_uuid=True), ForeignKey("specialists.user_id", ondelete="SET NULL"), nullable=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.user_id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_of_week = Column(ARRAY(Integer), nullable=False)  # [1 (lunes) .. 7 (domingo)] = date.isoweekday()
    scheduled_time = Column(Time, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    exercises = relationship(
        "RoutineExercise",
        order_by="RoutineExercise.order_index",
        cascade="all, delete-orphan",
    )


class RoutineExercise(Base):
    __tablename__ = "routine_exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    routine_id = Column(UUID(as_uuid=True), ForeignKey("routines.id", ondelete="CASCADE"), nullable=False)
    exercise_id = Column(String, ForeignKey("exercises.id"), nullable=False)
    order_index = Column(Integer, nullable=False)
    time_limit_seconds = Column(Integer, nullable=True)
    level = Column(Integer, nullable=False, default=1)
    total_series = Column(Integer, nullable=False, default=1)
    total_reps = Column(Integer, nullable=False, default=10)
    rest_time_seconds = Column(Integer, nullable=True)
