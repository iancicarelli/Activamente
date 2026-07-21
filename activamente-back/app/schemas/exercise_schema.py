from pydantic import BaseModel
from typing import Optional


class ExerciseResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    instructions: Optional[str]
    multimedia_url: Optional[str]

    model_config = {"from_attributes": True}
