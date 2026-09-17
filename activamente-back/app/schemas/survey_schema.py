from uuid import UUID

from pydantic import BaseModel, Field

from app.models.survey_model import SurveyType

# Escala única 1-5 para todas las preguntas (R-02 / UX-13).
Scale = Field(ge=1, le=5)


class SurveyCreatePre(BaseModel):
    session_id: UUID
    pain_level: int = Field(ge=1, le=5, description="Dolor (1 nada – 5 mucho)")
    fatigue_level: int = Field(ge=1, le=5, description="Cansancio (1-5)")
    stress_level: int | None = Field(default=None, ge=1, le=5, description="Estrés (1-5)")
    comments: str | None = Field(default=None, max_length=500)


class SurveyCreatePost(BaseModel):
    session_id: UUID
    mood_level: int = Field(ge=1, le=5, description="Ánimo (1 muy mal – 5 muy bien)")
    pain_level: int | None = Field(default=None, ge=1, le=5)
    comments: str | None = Field(default=None, max_length=500)


class SurveyResponse(BaseModel):
    id: UUID
    session_id: UUID
    type: SurveyType
    pain_level: int | None = None
    fatigue_level: int | None = None
    stress_level: int | None = None
    mood_level: int | None = None
    comments: str | None = None

    model_config = {"from_attributes": True}
