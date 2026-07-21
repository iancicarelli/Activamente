from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user_model import User
from app.models.exercise_model import Exercise
from app.schemas.exercise_schema import ExerciseResponse

router = APIRouter(prefix="/api/exercises", tags=["exercises-library"])


@router.get("", response_model=list[ExerciseResponse])
def get_exercises(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Exercise).all()
