import uuid
import enum
from sqlalchemy import Column, Date, Time, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class AppointmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    specialist_id = Column(UUID(as_uuid=True), ForeignKey("specialists.user_id"), nullable=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.user_id"), nullable=True)
    date = Column(Date, nullable=True)
    time_slot = Column(Time, nullable=True)
    status = Column(SAEnum(AppointmentStatus, name="appointment_status"), nullable=True)
    notes = Column(Text, nullable=True)
