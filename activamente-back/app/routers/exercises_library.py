from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.exercise_model import Exercise
from app.models.user_model import User
from app.schemas.exercise_schema import ExerciseResponse

router = APIRouter(prefix="/api/exercises", tags=["exercises-library"])


@router.get("", response_model=list[ExerciseResponse])
def get_exercises(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    """Catálogo con instrucciones y `max_level` (niveles disponibles por ejercicio)."""
    return db.query(Exercise).order_by(Exercise.name).all()
