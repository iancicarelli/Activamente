from sqlalchemy import Column, String, Text

from app.database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    multimedia_url = Column(String, nullable=True)
