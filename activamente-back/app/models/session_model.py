from sqlalchemy import Column, String, Integer, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base

class SessionExercise(Base):
    __tablename__ = "session_exercises"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True)) 
    exercise_id = Column(String) 
    routine_exercise_id = Column(UUID(as_uuid=True)) 
    series_completed = Column(Integer, default=0)
    reps_completed = Column(Integer, default=0)
    accuracy_score = Column(Float)
    feedback = Column(String)
