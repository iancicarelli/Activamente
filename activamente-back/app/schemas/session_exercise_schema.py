from uuid import UUID

from pydantic import BaseModel, Field


class SessionExerciseUpdate(BaseModel):
    series_completed: int = Field(ge=0, le=50)
    reps_completed: int = Field(ge=0, le=500)
    accuracy_score: float | None = Field(default=None, ge=0, le=100)
    feedback: str | None = Field(default=None, max_length=300)


class SessionExerciseResponse(BaseModel):
    id: UUID
    session_id: UUID
    exercise_id: str | None = None
    routine_exercise_id: UUID | None = None
    series_completed: int
    reps_completed: int
    accuracy_score: float | None = None
    feedback: str | None = None

    model_config = {"from_attributes": True}
