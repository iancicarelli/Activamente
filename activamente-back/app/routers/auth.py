from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.rut import normalize_rut, rut_column_normalized
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.patient_model import Patient
from app.models.specialist_model import Specialist
from app.models.user_model import User
from app.schemas.auth_schema import ChangePasswordRequest, LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

INVALID_CREDENTIALS = "El usuario o la contraseña no son correctos. Si olvidaste tu contraseña, pide ayuda a tu especialista."


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
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Login por `email` o por `rut` + `password`. El perfil se obtiene después
    con GET /api/me (EP-14)."""
    user = _find_user(db, body)

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)

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
