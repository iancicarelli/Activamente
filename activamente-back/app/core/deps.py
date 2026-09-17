import uuid as uuid_lib

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.database import get_db
from app.models.user_model import User, UserRole

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tu sesión expiró. Vuelve a ingresar.")

    try:
        user_id = uuid_lib.UUID(payload["sub"])
    except (KeyError, ValueError) as err:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.") from err

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado.")

    # Cuenta desactivada tras emitir el token: mata la sesión viva en el próximo
    # request (se relee users.is_active de la DB en cada llamada).
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada. Contacta a un administrador.",
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores.")
    return current_user


def require_specialist(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.SPECIALIST:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo especialistas.")
    return current_user


def require_patient(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.PATIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo pacientes.")
    return current_user


def require_staff(current_user: User = Depends(get_current_user)) -> User:
    """Especialista o admin."""
    if current_user.role not in (UserRole.SPECIALIST, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo especialistas o administradores.")
    return current_user
