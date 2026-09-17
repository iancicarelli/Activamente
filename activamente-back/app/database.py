import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

# Sin default a propósito (HC-15): un valor silencioso que no coincide con el
# compose produce errores confusos de conexión. Mejor fallar al arrancar.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
if not SQLALCHEMY_DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL no está definido. Copiá .env.example a .env en la raíz del repo "
        "(docker compose lo inyecta) o exportalo antes de arrancar la app."
    )

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency para inyectar la sesión en las rutas
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
