import enum
import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Text, Time
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class AppointmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    specialist_id = Column(UUID(as_uuid=True), ForeignKey("specialists.user_id", ondelete="SET NULL"), nullable=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.user_id", ondelete="SET NULL"), nullable=True)
    date = Column(Date, nullable=False)
    time_slot = Column(Time, nullable=False)
    status = Column(
        SAEnum(AppointmentStatus, name="appointment_status"),
        nullable=False,
        default=AppointmentStatus.CONFIRMED,
    )
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
