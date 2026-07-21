from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user, require_specialist
from app.core.security import hash_password
from app.models.user_model import User, UserRole
from app.models.patient_model import Patient
from app.models.specialist_patient_model import SpecialistPatient

from app.services.patient_metrics import (
    get_patient_alert,
    get_patient_metrics_and_sessions,
)
from app.schemas.patient_schema import (
    PatientResponse,
    PatientStatusUpdate,
    AssignPatientRequest,
    PatientListResponse,
)

router = APIRouter(prefix="/api/patients", tags=["patients"])


def normalize_rut(rut: str) -> str:
    """
    Normaliza un RUT para comparar contra el guardado en la BD: quita puntos,
    espacios y guiones, y pasa a mayúsculas. El frontend formatea el RUT con
    puntos (ej: "98.765.432-1") pero en la BD se guarda sin puntos
    ("98765432-1"), por lo que la búsqueda directa fallaba con 404.
    """
    return (rut or "").replace(".", "").replace(" ", "").replace("-", "").upper()


def _rut_column_normalized(column):
    """Misma normalización que normalize_rut() pero aplicada en SQL sobre la
    columna, para que la comparación no dependa del formato guardado."""
    return func.upper(
        func.replace(func.replace(func.replace(column, ".", ""), " ", ""), "-", "")
    )


@router.get("/", response_model=list[PatientListResponse])
def get_patients(
    limit: int = Query(50, ge=1, le=100, description="Max rows to return (paginación)"),
    offset: int = Query(0, ge=0, description="Rows to skip (paginación)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patients = (
        db.query(User)
        .filter(User.role == UserRole.PATIENT)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    results = []

    for p in patients:
        has_alert, alert_message = get_patient_alert(db, p.id)

        results.append(
            PatientListResponse(
                id=str(p.id),
                first_name=p.first_name,
                last_name=p.last_name,
                email=p.email,
                created_at=p.created_at,
                hasAlert=has_alert,
                alertMessage=alert_message
            )
        )
    return results

@router.get("/by-rut/{rut}", response_model=PatientResponse)
def get_patient_by_rut(
    rut: str,
    db: Session = Depends(get_db),
    _specialist: User = Depends(require_specialist),
):
    patient = db.query(Patient).filter(
        _rut_column_normalized(Patient.rut) == normalize_rut(rut)
    ).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado. Verifica el RUT.")

    user = db.query(User).filter(User.id == patient.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")

    metrics, sessions_list = get_patient_metrics_and_sessions(db, str(patient.user_id))

    return PatientResponse(
        id=str(patient.user_id),
        fullName=f"{user.first_name} {user.last_name}".strip(),
        rut=patient.rut,
        age=patient.age,
        gender=patient.gender,
        email=user.email,
        phone=patient.phone,
        address=patient.address,
        active=patient.is_active,
        metrics=metrics,
        sessions=sessions_list
    )


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient_by_id(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(User).filter(User.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    # Un especialista solo puede ver la ficha de los pacientes que tiene
    # asignados en specialist_patient. Otros roles (admin) no se restringen.
    if current_user.role == UserRole.SPECIALIST:
        assigned = (
            db.query(SpecialistPatient)
            .filter(
                SpecialistPatient.specialist_id == current_user.id,
                SpecialistPatient.patient_id == patient_id,
            )
            .first()
        )
        if not assigned:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este paciente")

    # patients.is_active es la fuente de verdad del estado del paciente
    # (coincide con /by-rut y PATCH /status).
    patient_row = db.query(Patient).filter(Patient.user_id == patient_id).first()
    
    metrics, sessions_list = get_patient_metrics_and_sessions(db, patient_id)
    
    return PatientResponse(
        id=str(patient.id),
        fullName=f"{patient.first_name} {patient.last_name}".strip(),
        email=patient.email,
        active=patient_row.is_active if patient_row else True,
        rut=patient_row.rut if patient_row else None,
        age=patient_row.age if patient_row else None,
        gender=patient_row.gender if patient_row else None,
        phone=patient_row.phone if patient_row else None,
        address=patient_row.address if patient_row else None,
        metrics=metrics,
        sessions=sessions_list
    )

# Asigna un paciente a un especialista. El especialista se obtiene del token
# del usuario que hace la peticion; el RUT del paciente viene en el body.
@router.post("/assign", status_code=status.HTTP_200_OK)
def assign_patient_to_specialist(
    body: AssignPatientRequest,
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    patient = db.query(Patient).filter(
        _rut_column_normalized(Patient.rut) == normalize_rut(body.rut)
    ).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado. Verifica el RUT.")

    already_assigned = (
        db.query(SpecialistPatient)
        .filter(
            SpecialistPatient.specialist_id == specialist.id,
            SpecialistPatient.patient_id == patient.user_id,
        )
        .first()
    )
    if already_assigned:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Paciente ya está asignado a este especialista")

    db.add(SpecialistPatient(specialist_id=specialist.id, patient_id=patient.user_id))
    db.commit()

    return {"message": "Paciente asignado correctamente"}

@router.patch("/{patient_id}/status", response_model=PatientResponse)
def update_patient_status(
    patient_id: str,
    body: PatientStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == patient_id, User.role == UserRole.PATIENT).first()
    if not user:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    patient = db.query(Patient).filter(Patient.user_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    # Fuente de verdad única: patients.is_active (la misma que lee /by-rut).
    patient.is_active = body.active
    db.commit()
    db.refresh(patient)

    return PatientResponse(
        id=str(user.id),
        fullName=f"{user.first_name} {user.last_name}".strip(),
        email=user.email,
        active=patient.is_active,
        rut=patient.rut,
        age=patient.age,
        gender=patient.gender,
        phone=patient.phone,
        address=patient.address,
    )



