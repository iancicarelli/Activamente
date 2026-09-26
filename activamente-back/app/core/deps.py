import uuid as uuid_lib

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.core.terms import TERMS_VERSION
from app.database import get_db
from app.models.terms_acceptance_model import TermsAcceptance
from app.models.user_model import User, UserRole

security = HTTPBearer()


TERMS_REQUIRED = "Debes aceptar los términos de uso para continuar."


def get_current_user_pending_terms(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Usuario autenticado y activo, haya aceptado o no los términos vigentes. Solo para las
    rutas que se necesitan ANTES de aceptarlos (leerlos, aceptarlos, cambiar la clave)."""
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


def get_current_user(
    user: User = Depends(get_current_user_pending_terms),
    db: Session = Depends(get_db),
) -> User:
    """Usuario autenticado, activo y con los términos VIGENTES aceptados (Ley 21.719: sin
    consentimiento no se tratan sus datos). Si no, 403 con la cabecera `X-Terms-Required`, que la
    app usa para llevarlo a la pantalla de términos."""
    accepted = (
        db.query(TermsAcceptance.user_id)
        .filter(TermsAcceptance.user_id == user.id, TermsAcceptance.version == TERMS_VERSION)
        .first()
    )
    if accepted is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=TERMS_REQUIRED, headers={"X-Terms-Required": "1"})
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
