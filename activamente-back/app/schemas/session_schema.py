from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.session_exercise_schema import SessionExerciseResponse


class SessionCreate(BaseModel):
    routine_id: UUID
    # Opcional: si el token es PATIENT se ignora y se usa el propio id (EP-02).
    # Un especialista/admin puede crear una sesión para un paciente asignado.
    patient_id: UUID | None = None


class SessionResponse(BaseModel):
    id: UUID
    patient_id: UUID
    routine_id: UUID | None = None
    date: datetime | None = None
    completed_at: datetime | None = None
    duration_minutes: int | None = None
    is_completed: bool = False
    # Uno por routine_exercise de la rutina, en orden order_index. POST los crea e
    # incluye sus ids reales para que el frontend haga el PUT de progreso.
    session_exercises: list[SessionExerciseResponse] = []

    model_config = {"from_attributes": True}
