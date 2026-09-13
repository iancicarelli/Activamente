from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.schemas.session_exercise_schema import SessionExerciseResponse



class SessionCreate(BaseModel):
    patient_id: UUID
    routine_id: UUID
    duration_minutes: Optional[int] = None


class SessionResponse(BaseModel):
    id: UUID
    patient_id: Optional[UUID] = None
    routine_id: Optional[UUID] = None
    date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    is_completed: Optional[bool] = None
    # Ejercicios de la sesión (uno por routine_exercise de la rutina). POST
    # /api/sessions los crea e incluye sus ids reales aquí para que el frontend
    # pueda hacer el PUT de progreso. /complete devuelve la lista por defecto.
    session_exercises: list[SessionExerciseResponse] = []

    class Config:
        from_attributes = True
