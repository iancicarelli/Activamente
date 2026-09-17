import os
from datetime import UTC, datetime, timedelta

from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY no está definido. Copiá .env.example a .env y seteá un " "secreto largo y aleatorio antes de arrancar la app."
    )
ALGORITHM = os.getenv("ALGORITHM", "HS256")
# Admin/especialista: 60 min. Paciente (adulto mayor, no debería reloguear a
# cada rato): 12 h por defecto (EP-07 / UX-14).
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
PATIENT_TOKEN_EXPIRE_MINUTES = int(os.getenv("PATIENT_TOKEN_EXPIRE_MINUTES", "720"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def token_lifetime_minutes(role: str) -> int:
    return PATIENT_TOKEN_EXPIRE_MINUTES if role == "PATIENT" else ACCESS_TOKEN_EXPIRE_MINUTES


def create_access_token(user_id: str, role: str) -> tuple[str, int]:
    """Devuelve (token, segundos_de_vida)."""
    minutes = token_lifetime_minutes(role)
    expire = datetime.now(UTC) + timedelta(minutes=minutes)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM), minutes * 60


def decode_token(token: str) -> dict:
    # `require_exp`: un token sin vencimiento sería eterno; se rechaza aunque la
    # firma sea válida (hallazgo del stack de seguridad, 2026-09-17).
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"require_exp": True})
    except JWTError:
        return {}
