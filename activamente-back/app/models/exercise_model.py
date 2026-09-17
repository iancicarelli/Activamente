from sqlalchemy import Column, Integer, String, Text

from app.database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(String, primary_key=True)  # slug: squat, toe_touch, leg_raise, shoulder_raises
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    multimedia_url = Column(String, nullable=True)
    # Niveles implementados por el validador del frontend (1..max_level).
    max_level = Column(Integer, nullable=False, default=1)
