from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.deps import get_current_user, require_specialist
from app.models.user_model import User
from app.models.routine_model import Routine, RoutineExercise
from app.schemas.routine_schema import (
    RoutineCreate,
    RoutineResponse,
    RoutineWithExercisesResponse,
)

router = APIRouter(prefix="/api/routines", tags=["routines"])


@router.post("", response_model=RoutineResponse)
def create_routine(
    body: RoutineCreate,
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    routine = Routine(
        specialist_id=specialist.id,
        patient_id=body.patient_id,
        name=body.name,
        start_date=body.start_date,
        end_date=body.end_date,
        day_of_week=body.day_of_week,
        scheduled_time=body.scheduled_time,
    )
    db.add(routine)
    db.flush()  # asigna routine.id sin cerrar la transaccion

    for exercise in body.exercises:
        db.add(
            RoutineExercise(
                routine_id=routine.id,
                exercise_id=exercise.exercise_id,
                order_index=exercise.order_index,
                level=exercise.level,
                total_series=exercise.total_series,
                total_reps=exercise.total_reps,
                rest_time_seconds=exercise.rest_time_seconds,
                time_limit_seconds=exercise.time_limit_seconds,
            )
        )

    db.commit()
    db.refresh(routine)
    return routine


@router.get("/active", response_model=RoutineWithExercisesResponse)
def get_active_routine(
    patient_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve la rutina vigente del paciente para HOY: aquella cuyo rango
    [start_date, end_date] incluye la fecha actual y cuyo day_of_week coincide
    con el dia de hoy. day_of_week es INT 1 (lunes) a 7 (domingo) segun init.sql,
    que coincide con datetime.isoweekday(). Si varias cumplen, gana la de
    start_date mas reciente y, ante igual start_date, la creada mas
    recientemente (created_at) -> la ultima que asigno el especialista. La
    serializacion con ejercicios anidados es la misma que GET /api/routines
    (mismo response_model + joinedload).
    """
    today = date.today()
    weekday = today.isoweekday()  # 1 (lunes) .. 7 (domingo)

    routine = (
        db.query(Routine)
        .options(joinedload(Routine.exercises))
        .filter(
            Routine.patient_id == patient_id,
            Routine.start_date <= today,
            Routine.end_date >= today,
            Routine.day_of_week == weekday,
        )
        .order_by(Routine.start_date.desc(), Routine.created_at.desc())
        .first()
    )

    if not routine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sin rutina activa para hoy",
        )

    return routine


@router.delete("/{routine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_routine(
    routine_id: UUID,
    db: Session = Depends(get_db),
    specialist: User = Depends(require_specialist),
):
    """
    Hard delete de una rutina. routine_exercises tiene ON DELETE CASCADE
    (ver init.sql), asi que sus filas hijas se borran solas. Devuelve 204.
    """
    routine = db.query(Routine).filter(Routine.id == routine_id).first()
    if not routine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rutina no encontrada",
        )

    # session_exercises.routine_exercise_id no tiene ON DELETE CASCADE en el
    # volumen de DB actual (init.sql ya lo corrige con SET NULL, pero requiere
    # reinicializar el volumen). Para que el borrado funcione con los datos
    # existentes, liberamos manualmente la FK borrando las metricas de sesion
    # que apuntan a los routine_exercises de esta rutina. Las filas de
    # `sessions` se conservan (solo se borran las de session_exercises), por lo
    # que el historial del paciente queda intacto.
    db.execute(
        text(
            """
            DELETE FROM session_exercises
            WHERE routine_exercise_id IN (
                SELECT id FROM routine_exercises WHERE routine_id = :routine_id
            )
            """
        ),
        {"routine_id": str(routine_id)},
    )

    # sessions.routine_id tampoco tiene ON DELETE en el volumen actual
    # (init.sql ya lo corrige con SET NULL). Conservamos las filas de
    # `sessions` (historial del paciente) desligandolas de la rutina antes de
    # borrarla: la sesion sigue existiendo con routine_id = NULL.
    db.execute(
        text("UPDATE sessions SET routine_id = NULL WHERE routine_id = :routine_id"),
        {"routine_id": str(routine_id)},
    )
    db.flush()

    db.delete(routine)
    db.commit()
    return None


@router.get("", response_model=list[RoutineWithExercisesResponse])
def get_routines(
    patient_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Routine)
        .options(joinedload(Routine.exercises))
        .filter(Routine.patient_id == patient_id)
        .all()
    )
