from datetime import datetime

from pydantic import BaseModel


class SurveySummary(BaseModel):
    """Encuesta resumida dentro de una sesión (escala 1-5)."""

    pain_level: int | None = None
    fatigue_level: int | None = None
    stress_level: int | None = None
    mood_level: int | None = None
    comments: str | None = None


class SessionItem(BaseModel):
    id: str
    name: str
    # ISO 8601 con zona horaria; el frontend formatea (HC-13).
    date: datetime
    completed_at: datetime | None = None
    duration_minutes: int | None = None
    completed: bool
    exercises_total: int = 0
    exercises_done: int = 0
    pre_survey: SurveySummary | None = None
    post_survey: SurveySummary | None = None


class WellbeingStatus(BaseModel):
    """Encuestas de la última sesión con encuesta y las métricas "en rojo" (alerta)."""

    session_id: str
    date: datetime
    has_alert: bool
    reasons: list[str] = []
    pre_survey: SurveySummary | None = None
    post_survey: SurveySummary | None = None


class ComplianceMetrics(BaseModel):
    sessionsCompleted: int
    sessionsTotal: int
    adherencePercent: int
    sessionsCompletedThisWeek: int = 0
    currentStreakDays: int = 0


class PatientListResponse(BaseModel):
    id: str
    first_name: str | None = None
    last_name: str | None = None
    email: str
    rut: str | None = None
    age: int | None = None
    is_active: bool = True
    created_at: datetime | None = None
    hasAlert: bool = False
    alertMessage: str | None = None
    # "wellbeing" (métricas en rojo en la última sesión) | "inactive" | None
    alertKind: str | None = None
    # Paciente sin sesiones todavía (no es una alerta, EP-09).
    isNew: bool = False
    lastSessionDate: datetime | None = None

    model_config = {"from_attributes": True}


class PatientResponse(BaseModel):
    id: str
    fullName: str
    email: str
    active: bool
    rut: str | None = None
    age: int | None = None
    gender: str | None = None
    phone: str | None = None
    address: str | None = None
    # Solo para especialistas: si el paciente ya está en su lista.
    assignedToMe: bool | None = None
    metrics: ComplianceMetrics | None = None
    sessions: list[SessionItem] | None = None
    wellbeing: WellbeingStatus | None = None

    model_config = {"from_attributes": True}


class PatientStatusUpdate(BaseModel):
    active: bool


class AssignPatientRequest(BaseModel):
    rut: str
