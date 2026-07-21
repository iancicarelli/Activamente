from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.deps import require_patient
from app.models.user_model import User
from app.models.survey_model import Survey
from app.schemas.survey_schema import SurveyCreatePre, SurveyCreatePost, SurveyResponse

router = APIRouter(
    prefix="/surveys",
    tags=["surveys"],
)

@router.post("/pre", response_model=SurveyResponse, status_code=status.HTTP_201_CREATED)
def create_pre_survey(
    survey_in: SurveyCreatePre,
    db: Session = Depends(get_db),
    _patient: User = Depends(require_patient),
):
    # We map effort and tiredness to pain_level and fatigue_level for simplicity
    new_survey = Survey(
        session_id=survey_in.session_id,
        type='PRE_SESSION',
        pain_level=survey_in.pain_level,
        fatigue_level=survey_in.fatigue_level,
        comments=survey_in.comments
    )
    db.add(new_survey)
    db.commit()
    db.refresh(new_survey)
    return new_survey

@router.post("/post", response_model=SurveyResponse, status_code=status.HTTP_201_CREATED)
def create_post_survey(
    survey_in: SurveyCreatePost,
    db: Session = Depends(get_db),
    _patient: User = Depends(require_patient),
):
    # Mood mapping: "Muy mal"(1), "Mal"(2), "Regular"(3), "Bien"(4), "Muy bien"(5)
    # We can store this as fatigue_level or pain_level, or we can just leave it in fatigue_level
    new_survey = Survey(
        session_id=survey_in.session_id,
        type='POST_SESSION',
        fatigue_level=survey_in.mood_level, # Mapping mood to fatigue as there is no mood column
        comments=survey_in.comments
    )
    db.add(new_survey)
    db.commit()
    db.refresh(new_survey)
    return new_survey
