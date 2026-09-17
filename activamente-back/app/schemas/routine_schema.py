from datetime import date, datetime, time
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class RoutineExerciseCreate(BaseModel):
    exercise_id: str = Field(min_length=1)
    order_index: int = Field(ge=0)
    level: int = Field(default=1, ge=1, le=3)
    total_series: int = Field(default=1, ge=1, le=10)
    total_reps: int = Field(default=10, ge=1, le=50)
    rest_time_seconds: int | None = Field(default=None, ge=0, le=600)
    time_limit_seconds: int | None = Field(default=None, ge=0)


class RoutineUpdate(BaseModel):
    """PUT /api/routines/{id}: reemplaza datos y ejercicios (el paciente no cambia)."""

    name: str = Field(min_length=1, max_length=120)
    start_date: date
    end_date: date
    days_of_week: list[Annotated[int, Field(ge=1, le=7)]] = Field(
        min_length=1, max_length=7, description="1 = lunes … 7 = domingo"
    )
    scheduled_time: time | None = None
    exercises: list[RoutineExerciseCreate] = Field(min_length=1)

    @field_validator("days_of_week")
    @classmethod
    def _unique_sorted_days(cls, days: list[int]) -> list[int]:
        if len(days) != len(set(days)):
            raise ValueError("Día de la semana repetido.")
        return sorted(days)

    @model_validator(mode="after")
    def _validate(self):
        if self.end_date < self.start_date:
            raise ValueError("La fecha de fin no puede ser anterior a la de inicio.")
        orders = [e.order_index for e in self.exercises]
        if len(orders) != len(set(orders)):
            raise ValueError("order_index repetido en los ejercicios.")
        ids = [e.exercise_id for e in self.exercises]
        if len(ids) != len(set(ids)):
            raise ValueError("Ejercicio repetido en la rutina.")
        return self


class RoutineCreate(RoutineUpdate):
    patient_id: UUID


class RoutineResponse(BaseModel):
    id: UUID
    specialist_id: UUID | None = None
    patient_id: UUID
    name: str
    start_date: date
    end_date: date
    days_of_week: list[int]
    scheduled_time: time | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class RoutineExerciseResponse(BaseModel):
    id: UUID
    exercise_id: str
    order_index: int
    level: int
    total_series: int
    total_reps: int
    rest_time_seconds: int | None = None
    time_limit_seconds: int | None = None

    model_config = {"from_attributes": True}


class RoutineWithExercisesResponse(RoutineResponse):
    exercises: list[RoutineExerciseResponse]


class NextRoutineResponse(BaseModel):
    """GET /api/routines/next: qué toca hoy o cuándo es la próxima (EP-05)."""

    routine: RoutineWithExercisesResponse | None = None
    next_date: date | None = None
    is_today: bool = False
    days_until: int | None = None
