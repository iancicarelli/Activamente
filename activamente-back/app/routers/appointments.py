from datetime import date as date_type
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.authz import assert_patient_access, get_patient_or_404
from app.core.config import today_local
from app.core.deps import get_current_user, require_patient, require_specialist
from app.database import get_db
from app.models.appointment_model import Appointment, AppointmentStatus
from app.models.user_model import User, UserRole
from app.schemas.appointment_schema import (
    AppointmentCreate,
    AppointmentDayCount,
    AppointmentResponse,
    AppointmentStatusUpdate,
    AvailableSlotsResponse,
    TimeSlotResponse,
)

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

# Franja de atención: cupos cada 30 min entre las 08:00 y las 20:00.
WORKING_START_HOUR = 8
WORKING_END_HOUR = 20
SLOT_MINUTES = 30


def _build_working_slots() -> list[str]:
    slots: list[str] = []
    minute = WORKING_START_HOUR * 60
    end = WORKING_END_HOUR * 60
    while minute < end:
        slots.append(f"{minute // 60:02d}:{minute % 60:02d}")
        minute += SLOT_MINUTES
    return slots


WORKING_SLOTS = _build_working_slots()

# Estados que ocupan un horario (una cita cancelada libera el cupo).
ACTIVE_STATUSES = (AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED)


def _to_response(db: Session, appointment: Appointment, users: dict | None = None) -> AppointmentResponse:
    users = users or {}
    if appointment.patient_id not in users:
        users[appointment.patient_id] = db.query(User).filter(User.id == appointment.patient_id).first()
    if appointment.specialist_id not in users:
        users[appointment.specialist_id] = db.query(User).filter(User.id == appointment.specialist_id).first()
    patient = users.get(appointment.patient_id)
    specialist = users.get(appointment.specialist_id)
    return AppointmentResponse(
        id=appointment.id,
        specialist_id=appointment.specialist_id,
        patient_id=appointment.patient_id,
        patient_name=patient.full_name if patient else "",
        specialist_name=specialist.full_name if specialist else "",
        date=appointment.date,
        time_slot=appointment.time_slot,
        status=appointment.status,
        notes=appointment.notes,
    )


def _responses(db: Session, appointments: list[Appointment]) -> list[AppointmentResponse]:
    ids = {a.patient_id for a in appointments} | {a.specialist_id for a in appointments}
    ids.discard(None)
    users = {u.id: u for u in db.query(User).filter(User.id.in_(ids)).all()} if ids else {}
    return [_to_response(db, a, users) for a in appointments]


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
def create_appointment(
    body: AppointmentCreate,
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """Agenda una cita para un paciente ASIGNADO. Fecha >= hoy, cupo válido, sin choque (EP-06)."""
    get_patient_or_404(db, body.patient_id)
    assert_patient_access(db, specialist, body.patient_id)

    if body.date < today_local():
        raise HTTPException(status_code=422, detail="No se pueden agendar citas en fechas pasadas.")
    slot = body.time_slot.strftime("%H:%M")
    if slot not in WORKING_SLOTS:
        raise HTTPException(
            status_code=422,
            detail=f"Horario fuera de la franja de atención ({WORKING_SLOTS[0]}–{WORKING_END_HOUR:02d}:00, cada {SLOT_MINUTES} min).",
        )

    clash = (
        db.query(Appointment)
        .filter(
            Appointment.specialist_id == specialist.id,
            Appointment.date == body.date,
            Appointment.time_slot == body.time_slot,
            Appointment.status.in_(ACTIVE_STATUSES),
        )
        .first()
    )
    if clash:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese horario ya está ocupado.")

    appointment = Appointment(
        specialist_id=specialist.id,
        patient_id=body.patient_id,
        date=body.date,
        time_slot=body.time_slot,
        status=AppointmentStatus.CONFIRMED,
        notes=(body.notes or "").strip() or None,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return _to_response(db, appointment)


@router.get("/available-slots", response_model=AvailableSlotsResponse)
def get_available_slots(
    date: date_type = Query(...),
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """Horarios fijos del día marcando cuáles ya están reservados."""
    taken = {
        appt.time_slot.strftime("%H:%M")
        for appt in db.query(Appointment)
        .filter(Appointment.specialist_id == specialist.id, Appointment.date == date, Appointment.status.in_(ACTIVE_STATUSES))
        .all()
        if appt.time_slot is not None
    }
    return AvailableSlotsResponse(date=date, slots=[TimeSlotResponse(time=s, available=s not in taken) for s in WORKING_SLOTS])


@router.get("/next", response_model=AppointmentResponse | None)
def get_next_appointment(
    db: Session = Depends(get_db),
    patient: User = Depends(require_patient),
):
    """Próxima cita futura del paciente autenticado (o null)."""
    appointment = (
        db.query(Appointment)
        .filter(
            Appointment.patient_id == patient.id,
            Appointment.date >= today_local(),
            Appointment.status.in_((AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED)),
        )
        .order_by(Appointment.date.asc(), Appointment.time_slot.asc())
        .first()
    )
    return _to_response(db, appointment) if appointment else None


@router.get("/calendar", response_model=list[AppointmentDayCount])
def get_calendar_counts(
    from_date: date_type = Query(..., alias="from"),
    to_date: date_type = Query(..., alias="to"),
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """Cantidad de citas activas por día en un rango (puntos del calendario, UX-06)."""
    if to_date < from_date or (to_date - from_date).days > 92:
        raise HTTPException(status_code=422, detail="Rango inválido (máximo 3 meses).")
    rows = (
        db.query(Appointment.date, func.count(Appointment.id))
        .filter(
            Appointment.specialist_id == specialist.id,
            Appointment.date >= from_date,
            Appointment.date <= to_date,
            Appointment.status.in_((AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED)),
        )
        .group_by(Appointment.date)
        .order_by(Appointment.date)
        .all()
    )
    return [AppointmentDayCount(date=d, count=int(c)) for d, c in rows]


@router.get("", response_model=list[AppointmentResponse])
def list_appointments(
    date: date_type | None = Query(None),
    from_date: date_type | None = Query(None, alias="from"),
    to_date: date_type | None = Query(None, alias="to"),
    patient_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Citas del usuario autenticado: especialista → las suyas (opcionalmente de un
    paciente asignado); paciente → las propias; admin → todas. Filtros: date, from/to.
    """
    query = db.query(Appointment)

    if current_user.role == UserRole.SPECIALIST:
        query = query.filter(Appointment.specialist_id == current_user.id)
    elif current_user.role == UserRole.PATIENT:
        query = query.filter(Appointment.patient_id == current_user.id)
    if patient_id is not None:
        assert_patient_access(db, current_user, patient_id)
        query = query.filter(Appointment.patient_id == patient_id)

    if date is not None:
        query = query.filter(Appointment.date == date)
    if from_date is not None:
        query = query.filter(Appointment.date >= from_date)
    if to_date is not None:
        query = query.filter(Appointment.date <= to_date)

    appointments = query.order_by(Appointment.date.asc(), Appointment.time_slot.asc()).all()
    return _responses(db, appointments)


@router.patch("/{appointment_id}/status", response_model=AppointmentResponse)
def update_appointment_status(
    appointment_id: UUID,
    body: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """Cancelar / confirmar / marcar completada una cita propia (HC-07)."""
    appointment = (
        db.query(Appointment).filter(Appointment.id == appointment_id, Appointment.specialist_id == specialist.id).first()
    )
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")

    appointment.status = body.status
    db.commit()
    db.refresh(appointment)
    return _to_response(db, appointment)
