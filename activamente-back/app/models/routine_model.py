import uuid
from sqlalchemy import Column, String, Integer, Date, Time, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Routine(Base):
    __tablename__ = "routines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    specialist_id = Column(UUID(as_uuid=True), ForeignKey("specialists.user_id"), nullable=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.user_id"), nullable=True)
    name = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    day_of_week = Column(Integer, nullable=True)  # 1 (Monday) to 7 (Sunday)
    scheduled_time = Column(Time, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    exercises = relationship(
        "RoutineExercise",
        order_by="RoutineExercise.order_index",
        cascade="all, delete-orphan",
    )


class RoutineExercise(Base):
    __tablename__ = "routine_exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    routine_id = Column(UUID(as_uuid=True), ForeignKey("routines.id", ondelete="CASCADE"))
    exercise_id = Column(String, ForeignKey("exercises.id"))
    order_index = Column(Integer, nullable=False)
    time_limit_seconds = Column(Integer, nullable=True)
    level = Column(Integer, nullable=True)
    total_series = Column(Integer, nullable=True)
    total_reps = Column(Integer, nullable=True)
    rest_time_seconds = Column(Integer, nullable=True)
