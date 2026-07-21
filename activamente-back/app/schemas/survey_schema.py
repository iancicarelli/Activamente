from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID

class SurveyCreatePre(BaseModel):
    session_id: UUID
    pain_level: int = Field(ge=1, le=10, description="Nivel de esfuerzo/dolor (1-10)")
    fatigue_level: int = Field(ge=1, le=10, description="Nivel de cansancio (1-10)")
    comments: Optional[str] = None

class SurveyCreatePost(BaseModel):
    session_id: UUID
    mood_level: int = Field(ge=1, le=5, description="Nivel de ánimo (1-5)")
    comments: Optional[str] = None

class SurveyResponse(BaseModel):
    id: UUID
    session_id: UUID
    type: str
    pain_level: Optional[int]
    fatigue_level: Optional[int]
    comments: Optional[str]

    class Config:
        from_attributes = True
