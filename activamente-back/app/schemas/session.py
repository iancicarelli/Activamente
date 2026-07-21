from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.schemas.session_schema import SessionExerciseResponse

# Aceptamos cualquier UUID válido, no solo v4 (los usuarios sembrados usan
# UUIDs no-v4 y siguen siendo válidos). Mismo criterio que routine_schema.py.
UUID4 = UUID


class SessionCreate(BaseModel):
    patient_id: UUID4
    routine_id: UUID4
    duration_minutes: Optional[int] = None


class SessionResponse(BaseModel):
    id: UUID4
    patient_id: Optional[UUID4] = None
    routine_id: Optional[UUID4] = None
    date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    is_completed: Optional[bool] = None
    # Ejercicios de la sesión (uno por routine_exercise de la rutina). POST
    # /api/sessions los crea e incluye sus ids reales aquí para que el frontend
    # pueda hacer el PUT de progreso. /complete devuelve la lista por defecto.
    session_exercises: list[SessionExerciseResponse] = []

    class Config:
        from_attributes = True
