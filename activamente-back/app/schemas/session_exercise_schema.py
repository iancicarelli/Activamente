from uuid import UUID
from pydantic import BaseModel
from typing import Optional


class SessionExerciseUpdate(BaseModel):
    series_completed: int
    reps_completed: int
    accuracy_score: Optional[float] = None
    feedback: Optional[str] = None

class SessionExerciseResponse(BaseModel):
    id: UUID
    session_id: UUID
    exercise_id: str
    series_completed: int
    reps_completed: int
    accuracy_score: Optional[float] = None
    feedback: Optional[str] = None
    
    class Config:
        from_attributes = True
