from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.database import Base


class TermsAcceptance(Base):
    """Un usuario aceptó una versión de los términos (app/core/terms.py)."""

    __tablename__ = "terms_acceptances"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    version = Column(String, primary_key=True)
    accepted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
