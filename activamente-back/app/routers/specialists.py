from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import require_specialist
from app.models.user_model import User
from app.models.specialist_model import Specialist
from app.models.specialist_patient_model import SpecialistPatient
from app.models.session_model import Session as SessionModel
from app.services.patient_metrics import get_patient_alert, get_patient_metrics_and_sessions
from app.schemas.specialist_schema import (
    SpecialistDashboardResponse,
    DashboardSpecialist,
    DashboardStats,
    DashboardProgress,
    SpecialistMeResponse,
    SpecialistMeUpdate,
)

router = APIRouter(prefix="/api/specialists", tags=["specialists"])


@router.get("/me", response_model=SpecialistMeResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """Perfil propio del especialista logueado (datos de users + specialists)."""
    row = db.query(Specialist).filter(Specialist.user_id == specialist.id).first()
    return SpecialistMeResponse(
        first_name=specialist.first_name,
        last_name=specialist.last_name,
        email=specialist.email,
        rut=row.rut if row else None,
        specialty=row.specialty if row else None,
        phone=row.phone if row else None,
        is_active=specialist.is_active,
    )


@router.patch("/me", response_model=SpecialistMeResponse)
def update_my_profile(
    body: SpecialistMeUpdate,
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """Actualiza el perfil propio (solo los campos presentes en el body)."""
    row = db.query(Specialist).filter(Specialist.user_id == specialist.id).first()
    if row is None:
        # Un especialista siempre debería tener su fila, pero la creamos por las
        # dudas para no romper si falta (mismo criterio tolerante del dashboard).
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

    return SpecialistMeResponse(
        first_name=specialist.first_name,
        last_name=specialist.last_name,
        email=specialist.email,
        rut=row.rut,
        specialty=row.specialty,
        phone=row.phone,
        is_active=specialist.is_active,
    )


@router.get("/dashboard", response_model=SpecialistDashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """
    Métricas del especialista logueado para su pantalla de inicio.

    El token devuelve un User cuyo .id == specialists.user_id == el
    specialist_id usado en specialist_patient (misma convención que
    patients.py). Todas las métricas se restringen a los pacientes ASIGNADOS
    al especialista vía specialist_patient.

    Reutiliza get_patient_alert y get_patient_metrics_and_sessions de
    app/services/patient_metrics.py para no duplicar la lógica de alertas ni
    de adherencia (módulo compartido, ya no importa de otro router).
    """
    today = date.today()

    # Datos del especialista (specialty vive en la tabla specialists).
    specialist_row = (
        db.query(Specialist).filter(Specialist.user_id == specialist.id).first()
    )
    full_name = f"{specialist.first_name or ''} {specialist.last_name or ''}".strip()

    # Ids de los pacientes asignados a este especialista.
    assigned_ids = [
        row.patient_id
        for row in db.query(SpecialistPatient.patient_id)
        .filter(SpecialistPatient.specialist_id == specialist.id)
        .all()
    ]
    total_patients = len(assigned_ids)

    # Sin pacientes asignados -> todo en cero (evita divisiones por cero).
    if not assigned_ids:
        return SpecialistDashboardResponse(
            specialist=DashboardSpecialist(
                full_name=full_name,
                specialty=specialist_row.specialty if specialist_row else None,
            ),
            stats=DashboardStats(
                total_patients=0, active_today=0, alerts=0, avg_adherence=0
            ),
            progress=DashboardProgress(
                sessions_completed_today=0,
                sessions_total_today=0,
                daily_compliance=0,
            ),
        )

    # Activos hoy: pacientes asignados con al menos una sesión completada hoy.
    active_today = (
        db.query(func.count(func.distinct(SessionModel.patient_id)))
        .filter(
            SessionModel.patient_id.in_(assigned_ids),
            SessionModel.is_completed.is_(True),
            func.date(SessionModel.date) == today,
        )
        .scalar()
    ) or 0

    # Alertas: pacientes asignados con alerta activa (lógica de patients.py).
    alerts = sum(
        1 for pid in assigned_ids if get_patient_alert(db, pid)[0]
    )

    # Adherencia promedio: media de adherencePercent de los pacientes asignados.
    adherences = [
        get_patient_metrics_and_sessions(db, str(pid))[0].adherencePercent
        for pid in assigned_ids
    ]
    avg_adherence = round(sum(adherences) / len(adherences)) if adherences else 0

    # Sesiones de hoy de los pacientes asignados (completadas y totales).
    sessions_total_today = (
        db.query(func.count(SessionModel.id))
        .filter(
            SessionModel.patient_id.in_(assigned_ids),
            func.date(SessionModel.date) == today,
        )
        .scalar()
    ) or 0
    sessions_completed_today = (
        db.query(func.count(SessionModel.id))
        .filter(
            SessionModel.patient_id.in_(assigned_ids),
            SessionModel.is_completed.is_(True),
            func.date(SessionModel.date) == today,
        )
        .scalar()
    ) or 0
    daily_compliance = (
        round(sessions_completed_today / sessions_total_today * 100)
        if sessions_total_today > 0
        else 0
    )

    return SpecialistDashboardResponse(
        specialist=DashboardSpecialist(
            full_name=full_name,
            specialty=specialist_row.specialty if specialist_row else None,
        ),
        stats=DashboardStats(
            total_patients=total_patients,
            active_today=active_today,
            alerts=alerts,
            avg_adherence=avg_adherence,
        ),
        progress=DashboardProgress(
            sessions_completed_today=sessions_completed_today,
            sessions_total_today=sessions_total_today,
            daily_compliance=daily_compliance,
        ),
    )
