from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession
from uuid import UUID

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user_model import User
from app.models.session import Session as SessionModel
from app.models.session_model import SessionExercise
from app.models.routine_model import RoutineExercise
from app.schemas.session import SessionCreate, SessionResponse
from app.schemas.session_schema import SessionExerciseUpdate, SessionExerciseResponse

router = APIRouter(
    prefix="/api/sessions",
    tags=["sessions"]
)


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    session_data: SessionCreate,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea un nuevo registro de sesión para un paciente y su rutina.
    La fecha se asigna automáticamente (DEFAULT NOW()) y la sesión
    arranca como no completada (is_completed = False).

    Además, en la misma operación, genera una fila session_exercises por cada
    routine_exercise de la rutina (en orden order_index), con contadores en 0.
    Así el frontend recibe ids reales de session_exercises para el PUT de
    progreso, en vez de depender de ids sembrados. Si la rutina no tiene
    ejercicios, la sesión queda válida igual (lista vacía).
    """
    new_session = SessionModel(
        patient_id=session_data.patient_id,
        routine_id=session_data.routine_id,
        duration_minutes=session_data.duration_minutes,
        is_completed=False,
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    routine_exercises = (
        db.query(RoutineExercise)
        .filter(RoutineExercise.routine_id == session_data.routine_id)
        .order_by(RoutineExercise.order_index)
        .all()
    )

    session_exercises = []
    for routine_exercise in routine_exercises:
        session_exercise = SessionExercise(
            session_id=new_session.id,
            exercise_id=routine_exercise.exercise_id,
            routine_exercise_id=routine_exercise.id,
            series_completed=0,
            reps_completed=0,
            accuracy_score=None,
            feedback=None,
        )
        db.add(session_exercise)
        session_exercises.append(session_exercise)

    db.commit()
    for session_exercise in session_exercises:
        db.refresh(session_exercise)

    # Adjuntamos la lista al objeto para que SessionResponse la serialice
    # (SessionModel no tiene relationship con session_exercises a nivel ORM).
    new_session.session_exercises = session_exercises

    return new_session


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: UUID,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve una sesión con sus session_exercises (incluye series_completed /
    reps_completed reales). La pantalla de resumen final lo usa para mostrar
    ejercicios completados, series totales y duración sin datos hardcodeados.
    SessionModel no tiene relationship ORM con session_exercises, asi que la
    lista se adjunta a mano (mismo patron que create_session).
    """
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.session_exercises = (
        db.query(SessionExercise)
        .filter(SessionExercise.session_id == session_id)
        .all()
    )
    return session


@router.post("/{session_id}/complete", response_model=SessionResponse)
def complete_session(
    session_id: UUID,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Marca una sesión existente como completada (is_completed = True) y calcula
    su duración en minutos.
    """
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_completed = True

    # Duración = minutos entre la creación de la sesión y ahora. El timestamp de
    # creación es sessions.date (server_default NOW(); la tabla no tiene
    # created_at). La columna es TIMESTAMP WITHOUT TIME ZONE y la DB corre en UTC,
    # igual que datetime.utcnow() → ambos naive-UTC, la resta es directa.
    # max(0, ...) evita negativos por un eventual skew de reloj.
    if session.date:
        elapsed_minutes = (datetime.utcnow() - session.date).total_seconds() / 60
        session.duration_minutes = max(0, round(elapsed_minutes))

    db.commit()
    db.refresh(session)

    return session


@router.put("/{session_id}/exercises/{session_exercise_id}", response_model=SessionExerciseResponse)
def update_exercise_progress(
    session_id: UUID,
    session_exercise_id: UUID,
    exercise_data: SessionExerciseUpdate,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza el total de series y repeticiones completadas para un ejercicio en una sesión.
    Se debe llamar desde el Frontend cuando el usuario presiona 'Terminar' el ejercicio.
    """
    # Buscar el registro del ejercicio en la sesión
    session_exercise = db.query(SessionExercise).filter(SessionExercise.id == session_exercise_id).first()

    if not session_exercise:
        raise HTTPException(status_code=404, detail="Exercise for this session not found")

    # Actualizar los totales
    session_exercise.series_completed = exercise_data.series_completed
    session_exercise.reps_completed = exercise_data.reps_completed

    if exercise_data.accuracy_score is not None:
        session_exercise.accuracy_score = exercise_data.accuracy_score

    if exercise_data.feedback is not None:
        session_exercise.feedback = exercise_data.feedback

    db.commit()
    db.refresh(session_exercise)

    return session_exercise
