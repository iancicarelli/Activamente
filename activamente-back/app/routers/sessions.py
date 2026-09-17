from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.orm import joinedload

from app.core.authz import assert_patient_access, get_session_for_user
from app.core.deps import get_current_user
from app.database import get_db
from app.models.routine_model import Routine, RoutineExercise
from app.models.session_exercise_model import SessionExercise
from app.models.session_model import Session as SessionModel
from app.models.user_model import User, UserRole
from app.schemas.session_exercise_schema import SessionExerciseResponse, SessionExerciseUpdate
from app.schemas.session_schema import SessionCreate, SessionResponse

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _sort_exercises(db: DBSession, session: SessionModel) -> SessionModel:
    """Ordena session_exercises por el order_index de la rutina (la relationship
    ordena por id, que es un UUID aleatorio). Los que ya no tienen
    routine_exercise (rutina borrada) van al final."""
    ids = [se.routine_exercise_id for se in session.session_exercises if se.routine_exercise_id]
    order = {}
    if ids:
        order = dict(db.query(RoutineExercise.id, RoutineExercise.order_index).filter(RoutineExercise.id.in_(ids)).all())
    session.session_exercises.sort(key=lambda se: (order.get(se.routine_exercise_id, 10_000), str(se.id)))
    return session


def _load(db: DBSession, session_id: UUID) -> SessionModel:
    session = (
        db.query(SessionModel).options(joinedload(SessionModel.session_exercises)).filter(SessionModel.id == session_id).first()
    )
    return _sort_exercises(db, session)


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    body: SessionCreate,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea la sesión y, en la MISMA transacción, una fila session_exercises por
    cada routine_exercise de la rutina (orden order_index) con contadores en 0.

    patient_id: si el token es PATIENT se usa el propio id (el body se ignora);
    especialista/admin deben tener acceso al paciente. La rutina debe ser de ese
    paciente (EP-02).
    """
    if current_user.role == UserRole.PATIENT:
        patient_id = current_user.id
    else:
        if body.patient_id is None:
            raise HTTPException(status_code=422, detail="Falta patient_id.")
        patient_id = assert_patient_access(db, current_user, body.patient_id)

    routine = db.query(Routine).filter(Routine.id == body.routine_id).first()
    if not routine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rutina no encontrada.")
    if routine.patient_id != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Esa rutina no pertenece al paciente.")

    new_session = SessionModel(patient_id=patient_id, routine_id=routine.id, is_completed=False)
    routine_exercises = (
        db.query(RoutineExercise).filter(RoutineExercise.routine_id == routine.id).order_by(RoutineExercise.order_index).all()
    )
    for re_ in routine_exercises:
        new_session.session_exercises.append(
            SessionExercise(
                exercise_id=re_.exercise_id,
                routine_exercise_id=re_.id,
                series_completed=0,
                reps_completed=0,
            )
        )
    db.add(new_session)
    db.commit()
    return _load(db, new_session.id)


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: UUID,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sesión con sus session_exercises (progreso real). Solo el dueño / su especialista / admin."""
    get_session_for_user(db, current_user, session_id)
    return _load(db, session_id)


@router.post("/{session_id}/complete", response_model=SessionResponse)
def complete_session(
    session_id: UUID,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Marca la sesión como completada. IDEMPOTENTE (EP-08): si ya estaba
    completada no recalcula la duración. La resta se hace con NOW() de la DB.
    """
    session = get_session_for_user(db, current_user, session_id)
    if not session.is_completed:
        now = db.query(func.now()).scalar()
        session.is_completed = True
        session.completed_at = now
        if session.date:
            elapsed = (now - session.date).total_seconds() / 60
            session.duration_minutes = max(0, round(elapsed))
        db.commit()
    return _load(db, session_id)


@router.put("/{session_id}/exercises/{session_exercise_id}", response_model=SessionExerciseResponse)
def update_exercise_progress(
    session_id: UUID,
    session_exercise_id: UUID,
    body: SessionExerciseUpdate,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persiste series/reps (y opcionalmente accuracy_score/feedback) de un ejercicio.
    Verifica que el session_exercise pertenezca a la sesión (EP-02)."""
    get_session_for_user(db, current_user, session_id)
    session_exercise = (
        db.query(SessionExercise)
        .filter(SessionExercise.id == session_exercise_id, SessionExercise.session_id == session_id)
        .first()
    )
    if not session_exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ese ejercicio no pertenece a la sesión.")

    session_exercise.series_completed = body.series_completed
    session_exercise.reps_completed = body.reps_completed
    if body.accuracy_score is not None:
        session_exercise.accuracy_score = body.accuracy_score
    if body.feedback is not None:
        session_exercise.feedback = body.feedback

    db.commit()
    db.refresh(session_exercise)
    return session_exercise
