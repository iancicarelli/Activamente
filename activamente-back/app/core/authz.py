"""
Autorización a nivel de RECURSO (no solo de rol). Todo endpoint que recibe un
patient_id / session_id / routine_id en la URL o el body debe pasar por acá.

Regla única (EP-01..EP-04):
  - ADMIN       → acceso a todo.
  - SPECIALIST  → solo pacientes asignados en specialist_patient.
  - PATIENT     → solo a sí mismo.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.patient_model import Patient
from app.models.routine_model import Routine
from app.models.session_model import Session as SessionModel
from app.models.specialist_patient_model import SpecialistPatient
from app.models.user_model import User, UserRole


def _as_uuid(value) -> UUID | None:
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return None


def is_assigned(db: Session, specialist_id: UUID, patient_id: UUID) -> bool:
    return (
        db.query(SpecialistPatient.patient_id)
        .filter(
            SpecialistPatient.specialist_id == specialist_id,
            SpecialistPatient.patient_id == patient_id,
        )
        .first()
        is not None
    )


def can_access_patient(db: Session, user: User, patient_id) -> bool:
    pid = _as_uuid(patient_id)
    if pid is None:
        return False
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.PATIENT:
        return user.id == pid
    return is_assigned(db, user.id, pid)


def assert_patient_access(db: Session, user: User, patient_id) -> UUID:
    """403 si el usuario no puede operar sobre ese paciente. Devuelve el UUID."""
    pid = _as_uuid(patient_id)
    if pid is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    if not can_access_patient(db, user, pid):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este paciente.")
    return pid


def get_patient_or_404(db: Session, patient_id) -> tuple[User, Patient]:
    pid = _as_uuid(patient_id)
    user = db.query(User).filter(User.id == pid, User.role == UserRole.PATIENT).first() if pid else None
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paciente no encontrado.")
    row = db.query(Patient).filter(Patient.user_id == pid).first()
    if not row:
        row = Patient(user_id=pid)
        db.add(row)
        db.flush()
    return user, row


def get_session_for_user(db: Session, user: User, session_id: UUID) -> SessionModel:
    """404 si no existe, 403 si el usuario no tiene acceso al paciente dueño."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada.")
    assert_patient_access(db, user, session.patient_id)
    return session


def get_routine_for_user(db: Session, user: User, routine_id: UUID) -> Routine:
    routine = db.query(Routine).filter(Routine.id == routine_id).first()
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rutina no encontrada.")
    assert_patient_access(db, user, routine.patient_id)
    return routine
