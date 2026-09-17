from pydantic import BaseModel


class DashboardSpecialist(BaseModel):
    full_name: str
    specialty: str | None = None


class DashboardStats(BaseModel):
    total_patients: int
    active_today: int
    alerts: int
    avg_adherence: int


class DashboardProgress(BaseModel):
    sessions_completed_today: int
    sessions_total_today: int
    daily_compliance: int


class SpecialistDashboardResponse(BaseModel):
    specialist: DashboardSpecialist
    stats: DashboardStats
    progress: DashboardProgress


# ─── Perfil propio del especialista (GET/PATCH /api/specialists/me) ────────────


class SpecialistMeResponse(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str
    rut: str | None = None
    specialty: str | None = None
    phone: str | None = None
    is_active: bool


class SpecialistMeUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    specialty: str | None = None
    phone: str | None = None
