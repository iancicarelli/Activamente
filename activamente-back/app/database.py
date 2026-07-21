import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

#SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://activamente:activamente_dev@db:5432/activamente_db")
# Example: postgresql://user:password@localhost/dbname
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/activamente")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency para inyectar la sesión en las rutas
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
