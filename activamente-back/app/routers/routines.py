from datetime import date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.authz import assert_patient_access, get_routine_for_user
from app.core.config import today_local
from app.core.deps import get_current_user, require_specialist
from app.database import get_db
from app.models.exercise_model import Exercise
from app.models.routine_model import Routine, RoutineExercise
from app.models.user_model import User, UserRole
from app.schemas.routine_schema import (
    NextRoutineResponse,
    RoutineCreate,
    RoutineUpdate,
    RoutineWithExercisesResponse,
)

router = APIRouter(prefix="/api/routines", tags=["routines"])


def _validate_exercises(db: Session, body: RoutineUpdate) -> None:
    """422 si algún exercise_id no existe o el nivel supera max_level (EP-04 / EX-32)."""
    ids = {e.exercise_id for e in body.exercises}
    catalog = {ex.id: ex for ex in db.query(Exercise).filter(Exercise.id.in_(ids)).all()}
    missing = sorted(ids - set(catalog))
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Ejercicio inexistente: {', '.join(missing)}",
        )
    for e in body.exercises:
        max_level = catalog[e.exercise_id].max_level or 1
        if e.level > max_level:
            raise HTTPException(
                status_code=422,
                detail=f"El ejercicio {e.exercise_id} solo tiene niveles 1-{max_level}.",
            )


@router.post("", response_model=RoutineWithExercisesResponse, status_code=status.HTTP_201_CREATED)
def create_routine(
    body: RoutineCreate,
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """Crea rutina + ejercicios en una transacción. Solo para pacientes asignados."""
    assert_patient_access(db, specialist, body.patient_id)
    _validate_exercises(db, body)

    routine = Routine(
        specialist_id=specialist.id,
        patient_id=body.patient_id,
        name=body.name.strip(),
        start_date=body.start_date,
        end_date=body.end_date,
        days_of_week=body.days_of_week,
        scheduled_time=body.scheduled_time,
    )
    for exercise in sorted(body.exercises, key=lambda e: e.order_index):
        routine.exercises.append(RoutineExercise(exercise_id=exercise.exercise_id, **_exercise_fields(exercise)))
    db.add(routine)
    db.commit()
    db.refresh(routine)
    return routine


def _exercise_fields(exercise) -> dict:
    return {
        "order_index": exercise.order_index,
        "level": exercise.level,
        "total_series": exercise.total_series,
        "total_reps": exercise.total_reps,
        "rest_time_seconds": exercise.rest_time_seconds,
        "time_limit_seconds": exercise.time_limit_seconds,
    }


def _get_own_routine(db: Session, current_user: User, routine_id: UUID) -> Routine:
    """404 si no existe; 403 si el especialista no es el dueño (admin puede todas)."""
    if current_user.role not in (UserRole.SPECIALIST, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo especialistas o administradores.")
    routine = db.query(Routine).filter(Routine.id == routine_id).first()
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rutina no encontrada")
    if current_user.role == UserRole.SPECIALIST and routine.specialist_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo puedes modificar rutinas que creaste.")
    return routine


@router.put("/{routine_id}", response_model=RoutineWithExercisesResponse)
def update_routine(
    routine_id: UUID,
    body: RoutineUpdate,
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """
    Edita una rutina propia. Los ejercicios se sincronizan por exercise_id: los
    que siguen se actualizan EN SU LUGAR (conservan su id, así una sesión en
    curso y el historial no pierden el vínculo), los nuevos se agregan y los
    quitados se borran (session_exercises.routine_exercise_id → NULL).
    """
    routine = _get_own_routine(db, specialist, routine_id)
    assert_patient_access(db, specialist, routine.patient_id)
    _validate_exercises(db, body)

    routine.name = body.name.strip()
    routine.start_date = body.start_date
    routine.end_date = body.end_date
    routine.days_of_week = body.days_of_week
    routine.scheduled_time = body.scheduled_time

    current = {re.exercise_id: re for re in routine.exercises}
    wanted = {e.exercise_id for e in body.exercises}
    for exercise_id, row in current.items():
        if exercise_id not in wanted:
            routine.exercises.remove(row)
    # order_index no es UNIQUE en la DB, así que se puede reasignar sin pasos intermedios.
    for exercise in body.exercises:
        row = current.get(exercise.exercise_id)
        if row is None:
            routine.exercises.append(RoutineExercise(exercise_id=exercise.exercise_id, **_exercise_fields(exercise)))
        else:
            for field, value in _exercise_fields(exercise).items():
                setattr(row, field, value)

    db.commit()
    return db.query(Routine).options(joinedload(Routine.exercises)).filter(Routine.id == routine.id).first()


def _active_routine_query(db: Session, patient_id: UUID, today: date):
    return (
        db.query(Routine)
        .options(joinedload(Routine.exercises))
        .filter(Routine.patient_id == patient_id, Routine.start_date <= today, Routine.end_date >= today)
        .order_by(Routine.start_date.desc(), Routine.created_at.desc())
    )


@router.get("/active", response_model=RoutineWithExercisesResponse)
def get_active_routine(
    patient_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Rutina vigente del paciente para HOY (rango de fechas + days_of_week
    contiene el isoweekday de hoy en APP_TIMEZONE). 404 si no toca hoy; para saber cuándo
    es la próxima usar GET /api/routines/next.
    """
    assert_patient_access(db, current_user, patient_id)
    today = today_local()
    routine = _active_routine_query(db, patient_id, today).filter(Routine.days_of_week.contains([today.isoweekday()])).first()
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sin rutina activa para hoy")
    return routine


@router.get("/next", response_model=NextRoutineResponse)
def get_next_routine(
    patient_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Qué toca hoy o cuándo es la próxima sesión (EP-05). Busca, día por día
    desde hoy, la primera fecha en la que alguna rutina vigente coincide con su
    days_of_week (máximo 8 días: una semana cubre todos los weekdays; se mira
    hasta 60 para rutinas que empiezan en el futuro). `routine: null` si no hay.
    """
    assert_patient_access(db, current_user, patient_id)
    today = today_local()
    horizon = today + timedelta(days=60)
    routines = (
        db.query(Routine)
        .options(joinedload(Routine.exercises))
        .filter(Routine.patient_id == patient_id, Routine.end_date >= today, Routine.start_date <= horizon)
        .order_by(Routine.start_date.desc(), Routine.created_at.desc())
        .all()
    )
    if not routines:
        return NextRoutineResponse()

    cursor = today
    while cursor <= horizon:
        weekday = cursor.isoweekday()
        for r in routines:  # ya ordenadas: la más reciente gana
            if r.start_date <= cursor <= r.end_date and weekday in r.days_of_week:
                delta = (cursor - today).days
                return NextRoutineResponse(routine=r, next_date=cursor, is_today=delta == 0, days_until=delta)
        cursor += timedelta(days=1)
    return NextRoutineResponse()


@router.get("", response_model=list[RoutineWithExercisesResponse])
def get_routines(
    patient_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assert_patient_access(db, current_user, patient_id)
    return (
        db.query(Routine)
        .options(joinedload(Routine.exercises))
        .filter(Routine.patient_id == patient_id)
        .order_by(Routine.created_at.desc())
        .all()
    )


@router.get("/{routine_id}", response_model=RoutineWithExercisesResponse)
def get_routine(
    routine_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = get_routine_for_user(db, current_user, routine_id)
    return db.query(Routine).options(joinedload(Routine.exercises)).filter(Routine.id == routine.id).first()


@router.delete("/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_routine(
    routine_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Hard delete. Solo el especialista dueño (o un admin). routine_exercises se
    borra por CASCADE; sessions.routine_id y session_exercises.routine_exercise_id
    quedan en NULL por ON DELETE SET NULL (init.sql), así el historial se conserva.
    """
    routine = _get_own_routine(db, current_user, routine_id)
    db.delete(routine)
    db.commit()
    return None
