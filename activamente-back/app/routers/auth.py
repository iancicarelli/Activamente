from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.rate_limit import login_limiter
from app.core.rut import normalize_rut, rut_column_normalized
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.patient_model import Patient
from app.models.specialist_model import Specialist
from app.models.user_model import User
from app.schemas.auth_schema import ChangePasswordRequest, LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

INVALID_CREDENTIALS = "El usuario o la contraseña no son correctos. Si olvidaste tu contraseña, pide ayuda a tu especialista."


def _account_key(body: LoginRequest) -> str:
    """Identificador de la cuenta para el límite de intentos (SEC-05), normalizado para que
    `Pedro@x.cl` y `pedro@x.cl`, o `9.876.543-2` y `98765432`, cuenten como la misma."""
    if body.email:
        return "email:" + body.email.strip().lower()
    return "rut:" + (normalize_rut(body.rut) or "")


def _find_user(db: Session, body: LoginRequest) -> User | None:
    if body.email:
        return db.query(User).filter(User.email == body.email.strip().lower()).first()

    # Login por RUT (R-05): busca en patients y specialists con RUT normalizado.
    rut = normalize_rut(body.rut)
    if not rut:
        return None
    patient = db.query(Patient).filter(rut_column_normalized(Patient.rut) == rut).first()
    if patient:
        return db.query(User).filter(User.id == patient.user_id).first()
    specialist = db.query(Specialist).filter(rut_column_normalized(Specialist.rut) == rut).first()
    if specialist:
        return db.query(User).filter(User.id == specialist.user_id).first()
    return None


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Login por `email` o por `rut` + `password`. El perfil se obtiene después
    con GET /api/me (EP-14). Con demasiados fallos recientes responde 429 (SEC-05)
    antes de mirar la contraseña, aunque esta sea correcta."""
    ip = request.client.host if request.client else "unknown"
    account = _account_key(body)
    wait = login_limiter.retry_after(ip, account)
    if wait:
        minutes = (wait + 59) // 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Demasiados intentos fallidos. Espera {minutes} {'minuto' if minutes == 1 else 'minutos'} e inténtalo de nuevo.",
            headers={"Retry-After": str(wait)},
        )

    user = _find_user(db, body)

    if not user or not verify_password(body.password, user.password_hash):
        login_limiter.record_failure(ip, account)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)
    login_limiter.reset(ip, account)

    # Cuenta desactivada: credenciales válidas pero sin acceso. 403 para que el
    # front lo distinga del 401 de credenciales.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está desactivada. Contacta a tu especialista o a un administrador.",
        )

    token, expires_in = create_access_token(user_id=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id, expires_in=expires_in)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cambia la contraseña del usuario logueado (cualquier rol). Reverifica la
    contraseña actual antes de guardar el nuevo hash."""
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual es incorrecta.")

    current_user.password_hash = hash_password(body.new_password)
    db.commit()
