from pydantic import BaseModel


class ExerciseResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    instructions: str | None = None
    multimedia_url: str | None = None
    max_level: int = 1

    model_config = {"from_attributes": True}
