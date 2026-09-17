from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.authz import assert_patient_access, get_patient_or_404, is_assigned
from app.core.deps import get_current_user, require_patient, require_specialist, require_staff
from app.core.rut import normalize_rut, rut_column_normalized
from app.database import get_db
from app.models.patient_model import Patient
from app.models.specialist_patient_model import SpecialistPatient
from app.models.user_model import User, UserRole
from app.schemas.patient_schema import (
    AssignPatientRequest,
    PatientListResponse,
    PatientResponse,
    PatientStatusUpdate,
    SessionItem,
)
from app.services.patient_metrics import (
    get_alerts_bulk,
    get_patient_metrics_and_sessions,
    get_patient_sessions,
    get_wellbeing_status,
)

router = APIRouter(prefix="/api/patients", tags=["patients"])


def _patient_response(
    db: Session, user: User, row: Patient | None, current_user: User, with_history: bool = True
) -> PatientResponse:
    metrics, sessions = get_patient_metrics_and_sessions(db, user.id) if with_history else (None, None)
    assigned = is_assigned(db, current_user.id, user.id) if current_user.role == UserRole.SPECIALIST else None
    return PatientResponse(
        id=str(user.id),
        fullName=user.full_name,
        email=user.email,
        active=user.is_active,
        rut=row.rut if row else None,
        age=row.age if row else None,
        gender=row.gender if row else None,
        phone=row.phone if row else None,
        address=row.address if row else None,
        assignedToMe=assigned,
        metrics=metrics,
        sessions=sessions,
        wellbeing=get_wellbeing_status(db, user.id) if with_history else None,
    )


@router.get("/", response_model=list[PatientListResponse])
def get_patients(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """
    Especialista → SOLO sus pacientes asignados (EP-01). Admin → todos.
    Un paciente no puede listar pacientes (R-11 → 403 por require_staff).
    Alertas calculadas en bloque (sin N+1).
    """
    query = db.query(User, Patient).outerjoin(Patient, Patient.user_id == User.id).filter(User.role == UserRole.PATIENT)
    if current_user.role == UserRole.SPECIALIST:
        query = query.join(SpecialistPatient, SpecialistPatient.patient_id == User.id).filter(
            SpecialistPatient.specialist_id == current_user.id
        )
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter((User.first_name.ilike(term)) | (User.last_name.ilike(term)) | (User.email.ilike(term)))

    rows = query.order_by(User.last_name.asc(), User.first_name.asc()).offset(offset).limit(limit).all()
    alerts = get_alerts_bulk(db, [u.id for u, _ in rows])

    results = []
    for user, row in rows:
        info = alerts[user.id]
        results.append(
            PatientListResponse(
                id=str(user.id),
                first_name=user.first_name,
                last_name=user.last_name,
                email=user.email,
                rut=row.rut if row else None,
                age=row.age if row else None,
                is_active=user.is_active,
                created_at=user.created_at,
                hasAlert=info.has_alert,
                alertMessage=info.message,
                alertKind=info.kind,
                isNew=info.is_new,
                lastSessionDate=info.last_session_date,
            )
        )
    return results


@router.get("/me/sessions", response_model=list[SessionItem])
def get_my_sessions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    patient: User = Depends(require_patient),
):
    """Historial del paciente logueado (UX-17)."""
    return get_patient_sessions(db, patient.id, limit=limit, offset=offset)


@router.get("/by-rut/{rut}", response_model=PatientResponse)
def get_patient_by_rut(
    rut: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """Búsqueda por RUT para asignar. Devuelve ficha SIN historial si el
    especialista aún no tiene asignado al paciente (solo lo necesario para
    confirmar identidad); con historial si ya está asignado o es admin."""
    row = db.query(Patient).filter(rut_column_normalized(Patient.rut) == normalize_rut(rut)).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado. Verifica el RUT.")
    user = db.query(User).filter(User.id == row.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")

    can_see_history = current_user.role == UserRole.ADMIN or is_assigned(db, current_user.id, user.id)
    return _patient_response(db, user, row, current_user, with_history=can_see_history)


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient_by_id(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ficha completa. Admin: cualquiera; especialista: solo asignados; paciente: solo él."""
    user, row = get_patient_or_404(db, patient_id)
    assert_patient_access(db, current_user, user.id)
    return _patient_response(db, user, row, current_user)


@router.post("/assign", status_code=status.HTTP_200_OK)
def assign_patient_to_specialist(
    body: AssignPatientRequest,
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """Agrega un paciente (por RUT) a la lista del especialista del token."""
    row = db.query(Patient).filter(rut_column_normalized(Patient.rut) == normalize_rut(body.rut)).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado. Verifica el RUT.")

    if is_assigned(db, specialist.id, row.user_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El paciente ya está en tu lista.")

    db.add(SpecialistPatient(specialist_id=specialist.id, patient_id=row.user_id))
    db.commit()
    return {"message": "Paciente asignado correctamente", "patient_id": str(row.user_id)}


@router.delete("/{patient_id}/assign", status_code=status.HTTP_204_NO_CONTENT)
def unassign_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """Quita al paciente de la lista del especialista (no toca la cuenta)."""
    link = (
        db.query(SpecialistPatient)
        .filter(SpecialistPatient.specialist_id == specialist.id, SpecialistPatient.patient_id == patient_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El paciente no está en tu lista.")
    db.delete(link)
    db.commit()
    return None


@router.patch("/{patient_id}/status", response_model=PatientResponse)
def update_patient_status(
    patient_id: str,
    body: PatientStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """
    Habilita/deshabilita la CUENTA del paciente (users.is_active, R-01 opción a):
    un paciente deshabilitado no puede iniciar sesión y su token vivo deja de
    servir. Solo el especialista asignado o un admin.
    """
    user, row = get_patient_or_404(db, patient_id)
    assert_patient_access(db, current_user, user.id)

    user.is_active = body.active
    db.commit()
    db.refresh(user)
    return _patient_response(db, user, row, current_user, with_history=False)
