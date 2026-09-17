from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import LOCAL_TZ, today_local
from app.core.deps import require_specialist
from app.database import get_db
from app.models.routine_model import Routine
from app.models.session_model import Session as SessionModel
from app.models.specialist_model import Specialist
from app.models.specialist_patient_model import SpecialistPatient
from app.models.user_model import User
from app.schemas.specialist_schema import (
    DashboardProgress,
    DashboardSpecialist,
    DashboardStats,
    SpecialistDashboardResponse,
    SpecialistMeResponse,
    SpecialistMeUpdate,
)
from app.services.patient_metrics import adherence_percent, get_adherence_bulk, get_alerts_bulk

router = APIRouter(prefix="/api/specialists", tags=["specialists"])


def _me_response(user: User, row: Specialist | None) -> SpecialistMeResponse:
    return SpecialistMeResponse(
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        rut=row.rut if row else None,
        specialty=row.specialty if row else None,
        phone=row.phone if row else None,
        is_active=user.is_active,
    )


@router.get("/me", response_model=SpecialistMeResponse)
def get_my_profile(db: Session = Depends(get_db), specialist: User = Depends(require_specialist)):
    row = db.query(Specialist).filter(Specialist.user_id == specialist.id).first()
    return _me_response(specialist, row)


@router.patch("/me", response_model=SpecialistMeResponse)
def update_my_profile(
    body: SpecialistMeUpdate,
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    row = db.query(Specialist).filter(Specialist.user_id == specialist.id).first()
    if row is None:
        row = Specialist(user_id=specialist.id)
        db.add(row)

    data = body.model_dump(exclude_unset=True)
    if "first_name" in data:
        specialist.first_name = data["first_name"]
    if "last_name" in data:
        specialist.last_name = data["last_name"]
    if "specialty" in data:
        row.specialty = data["specialty"]
    if "phone" in data:
        row.phone = data["phone"]

    db.commit()
    db.refresh(specialist)
    db.refresh(row)
    return _me_response(specialist, row)


def _local_date(column):
    """DATE de un TIMESTAMPTZ en la zona horaria de la clínica."""
    return func.date(func.timezone(str(LOCAL_TZ), column))


@router.get("/dashboard", response_model=SpecialistDashboardResponse)
def get_dashboard(db: Session = Depends(get_db), specialist: User = Depends(require_specialist)):
    """
    Métricas de la pantalla de inicio, restringidas a los pacientes asignados.
    Número fijo de queries independiente de la cantidad de pacientes (EP-10).
    "Sesiones de hoy" se cuenta por paciente: completados / (con rutina hoy ∪ completados).
    """
    today = today_local()
    specialist_row = db.query(Specialist).filter(Specialist.user_id == specialist.id).first()
    header = DashboardSpecialist(full_name=specialist.full_name, specialty=specialist_row.specialty if specialist_row else None)

    assigned_ids = [
        pid for (pid,) in db.query(SpecialistPatient.patient_id).filter(SpecialistPatient.specialist_id == specialist.id).all()
    ]
    if not assigned_ids:
        return SpecialistDashboardResponse(
            specialist=header,
            stats=DashboardStats(total_patients=0, active_today=0, alerts=0, avg_adherence=0),
            progress=DashboardProgress(sessions_completed_today=0, sessions_total_today=0, daily_compliance=0),
        )

    # Pacientes a los que HOY les toca rutina (vigente y con el día de la semana de hoy).
    scheduled = {
        pid
        for (pid,) in db.query(Routine.patient_id)
        .filter(
            Routine.patient_id.in_(assigned_ids),
            Routine.start_date <= today,
            Routine.end_date >= today,
            Routine.days_of_week.contains([today.isoweekday()]),
        )
        .distinct()
        .all()
    }
    # Pacientes que COMPLETARON una sesión hoy. Se cuenta por completed_at y no por
    # la fecha de inicio: una sesión empezada a las 23:59 y terminada a las 00:06 es de hoy.
    completed = {
        pid
        for (pid,) in db.query(SessionModel.patient_id)
        .filter(
            SessionModel.patient_id.in_(assigned_ids),
            SessionModel.is_completed.is_(True),
            _local_date(SessionModel.completed_at) == today,
        )
        .distinct()
        .all()
    }
    started = {
        pid
        for (pid,) in db.query(SessionModel.patient_id)
        .filter(SessionModel.patient_id.in_(assigned_ids), _local_date(SessionModel.date) == today)
        .distinct()
        .all()
    }
    active_today = len(completed | started)
    # Total del día = a quienes les tocaba + quienes igual entrenaron sin tocarles.
    sessions_total_today = len(scheduled | completed)
    sessions_completed_today = len(completed)

    alerts = sum(1 for info in get_alerts_bulk(db, assigned_ids).values() if info.has_alert)
    adherences = [adherence_percent(c, t) for c, t in get_adherence_bulk(db, assigned_ids).values()]
    avg_adherence = round(sum(adherences) / len(adherences)) if adherences else 0

    return SpecialistDashboardResponse(
        specialist=header,
        stats=DashboardStats(
            total_patients=len(assigned_ids),
            active_today=active_today,
            alerts=alerts,
            avg_adherence=avg_adherence,
        ),
        progress=DashboardProgress(
            sessions_completed_today=sessions_completed_today,
            sessions_total_today=sessions_total_today,
            daily_compliance=adherence_percent(sessions_completed_today, sessions_total_today),
        ),
    )
