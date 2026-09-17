from datetime import date as date_type
from datetime import time as time_type
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.appointment_model import AppointmentStatus


class AppointmentCreate(BaseModel):
    patient_id: UUID
    date: date_type
    time_slot: time_type
    notes: str | None = Field(default=None, max_length=500)


class AppointmentResponse(BaseModel):
    id: UUID
    specialist_id: UUID | None = None
    patient_id: UUID | None = None
    patient_name: str
    specialist_name: str
    date: date_type
    time_slot: time_type
    status: AppointmentStatus
    notes: str | None = None

    model_config = {"from_attributes": True}


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus


class TimeSlotResponse(BaseModel):
    time: str  # "HH:MM"
    available: bool


class AvailableSlotsResponse(BaseModel):
    date: date_type
    slots: list[TimeSlotResponse]


class AppointmentDayCount(BaseModel):
    date: date_type
    count: int
