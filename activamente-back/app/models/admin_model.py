from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Admin(Base):
    __tablename__ = "admin"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    job_title = Column(String, nullable=True)
    phone = Column(String, nullable=True)
