from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class SessionItem(BaseModel):
    id: str
    name: str
    duration: str
    date: str
    completed: bool

class ComplianceMetrics(BaseModel):
    sessionsCompleted: int
    sessionsTotal: int
    adherencePercent: int

class PatientListResponse(BaseModel):
    id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    created_at: Optional[datetime] = None
    hasAlert: bool = False
    alertMessage: Optional[str] = None
    
    model_config = {"from_attributes": True}


class PatientBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr


class PatientCreate(PatientBase):
    password: str


class PatientCreateResponse(PatientBase):
    id: str
    role: str

    model_config = {"from_attributes": True}


class PatientResponse(BaseModel):
    id: str
    fullName: str
    email: str
    active: bool
    # Optional patient-specific fields (returned by /by-rut). Declared here so
    # FastAPI's response_model doesn't strip them from the response.
    rut: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    metrics: Optional[ComplianceMetrics] = None
    sessions: Optional[List[SessionItem]] = None

    model_config = {"from_attributes": True}


class PatientStatusUpdate(BaseModel):
    active: bool


class AssignPatientRequest(BaseModel):
    rut: str
