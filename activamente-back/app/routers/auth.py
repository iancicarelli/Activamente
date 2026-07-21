from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app.models.user_model import User
from app.schemas.auth_schema import LoginRequest, TokenResponse, ChangePasswordRequest
from app.core.security import verify_password, hash_password, create_access_token
from app.schemas.patient_schema import PatientResponse
from app.models.patient_model import Patient
from app.models.user_model import UserRole

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Cuenta desactivada por un admin (PATCH /api/users/{id}/status): credenciales
    # válidas pero sin acceso. 403 para que el front lo distinga del 401 de login.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada. Contactá a un administrador.",
        )

    token = create_access_token(user_id=str(user.id), role=user.role.value)

    patient_info = None
    if user.role == UserRole.PATIENT:
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if patient:
            patient_info = PatientResponse(
                id=str(user.id),
                fullName=f"{user.first_name} {user.last_name}",
                email=user.email,
                active=patient.is_active,
                rut=patient.rut,
                age=patient.age,
                gender=patient.gender,
                phone=patient.phone,
                address=patient.address,
            )

    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        patient=patient_info
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cambia la contraseña del usuario logueado (cualquier rol). Reverifica la
    contraseña actual antes de guardar el nuevo hash (operación sensible, por eso
    vive en auth.py y no dentro del PATCH de perfil).
    """
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual es incorrecta.",
        )

    current_user.password_hash = hash_password(body.new_password)
    db.commit()
