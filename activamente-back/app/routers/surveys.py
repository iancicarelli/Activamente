from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.authz import get_session_for_user
from app.core.deps import require_patient
from app.database import get_db
from app.models.survey_model import Survey, SurveyType
from app.models.user_model import User
from app.schemas.survey_schema import SurveyCreatePost, SurveyCreatePre, SurveyResponse

# Prefijo /api como el resto (EP-13).
router = APIRouter(prefix="/api/surveys", tags=["surveys"])


def _upsert(db: Session, session_id, survey_type: SurveyType, **fields) -> Survey:
    """Una sola encuesta por (sesión, tipo): reenviar actualiza en vez de duplicar."""
    survey = db.query(Survey).filter(Survey.session_id == session_id, Survey.type == survey_type).first()
    if survey is None:
        survey = Survey(session_id=session_id, type=survey_type)
        db.add(survey)
    for key, value in fields.items():
        setattr(survey, key, value)
    db.commit()
    db.refresh(survey)
    return survey


@router.post("/pre", response_model=SurveyResponse, status_code=status.HTTP_201_CREATED)
def create_pre_survey(
    body: SurveyCreatePre,
    db: Session = Depends(get_db),
    patient: User = Depends(require_patient),
):
    """Encuesta previa: dolor, cansancio y estrés (1-5). Solo el dueño de la sesión."""
    get_session_for_user(db, patient, body.session_id)
    return _upsert(
        db,
        body.session_id,
        SurveyType.PRE_SESSION,
        pain_level=body.pain_level,
        fatigue_level=body.fatigue_level,
        stress_level=body.stress_level,
        comments=body.comments,
    )


@router.post("/post", response_model=SurveyResponse, status_code=status.HTTP_201_CREATED)
def create_post_survey(
    body: SurveyCreatePost,
    db: Session = Depends(get_db),
    patient: User = Depends(require_patient),
):
    """Encuesta posterior: ánimo (1-5) y dolor opcional. Solo el dueño de la sesión."""
    get_session_for_user(db, patient, body.session_id)
    return _upsert(
        db,
        body.session_id,
        SurveyType.POST_SESSION,
        mood_level=body.mood_level,
        pain_level=body.pain_level,
        comments=body.comments,
    )
