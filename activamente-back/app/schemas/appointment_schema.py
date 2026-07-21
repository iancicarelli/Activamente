from datetime import date as date_type, time as time_type
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel

from app.models.appointment_model import AppointmentStatus


class AppointmentCreate(BaseModel):
    patient_id: UUID
    date: date_type
    time_slot: time_type
    notes: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: UUID
    specialist_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    patient_name: str
    specialist_name: str
    date: date_type
    time_slot: time_type
    status: AppointmentStatus
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus


class TimeSlotResponse(BaseModel):
    time: str        # "HH:MM"
    available: bool


class AvailableSlotsResponse(BaseModel):
    date: date_type
    slots: List[TimeSlotResponse]
