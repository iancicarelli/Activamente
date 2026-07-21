import secrets
import string
import unicodedata
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import require_admin
from app.core.security import hash_password
from app.models.user_model import User, UserRole
from app.models.patient_model import Patient
from app.models.specialist_model import Specialist
from app.models.admin_model import Admin
from app.schemas.user_schema import (
    CreateUserRequest,
    UserResponse,
    UserListItem,
    UserStatusUpdate,
    role_from_str,
)

router = APIRouter(prefix="/api/users", tags=["users"])


_TEMP_PASSWORD_SYMBOLS = "!#$"


def _generate_temp_password(name: str) -> str:
    """Contraseña temporal memorable: Nombre + 3 dígitos + 1 símbolo.

    Ej.: "Juan704#" — reconocible para el usuario, pero con la parte
    aleatoria (dígitos + símbolo) distinta cada vez, así no se deduce de
    ver otra. El nombre se normaliza (sin tildes/espacios, solo letras).
    """
    # Normaliza: primer token, sin tildes, solo letras ASCII, capitalizado.
    first_token = name.strip().split(" ")[0] if name and name.strip() else ""
    normalized = unicodedata.normalize("NFKD", first_token)
    ascii_only = "".join(c for c in normalized if c.isascii() and c.isalpha())
    base = ascii_only.capitalize() or "User"

    digits = "".join(secrets.choice(string.digits) for _ in range(3))
    symbol = secrets.choice(_TEMP_PASSWORD_SYMBOLS)
    return f"{base}{digits}{symbol}"


@router.get("", response_model=list[UserListItem])
def list_users(
    search: Optional[str] = Query(None, description="Filter by name or email"),
    role: Optional[str] = Query(None, description="Filter by role (admin/especialista/paciente)"),
    limit: int = Query(50, ge=1, le=100, description="Max rows to return (paginación)"),
    offset: int = Query(0, ge=0, description="Rows to skip (paginación)"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(User)

    if role:
        try:
            query = query.filter(User.role == role_from_str(role))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid role: {role}",
            )

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.email.ilike(term),
            )
        )

    return query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()


@router.patch("/{user_id}/status", response_model=UserListItem)
def update_user_status(
    user_id: str,
    body: UserStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == admin.id and not body.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta",
        )

    user.is_active = body.is_active
    db.commit()
    db.refresh(user)
    return user


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    try:
        role = body.mapped_role()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    first_name, last_name = body.split_name()
    temp_password = _generate_temp_password(first_name)

    user = User(
        first_name=first_name,
        last_name=last_name,
        email=body.email,
        password_hash=hash_password(temp_password),
        role=role,
    )
    db.add(user)
    db.flush()  # get user.id before committing

    if role == UserRole.PATIENT:
        db.add(Patient(
            user_id=user.id,
            rut=body.rut,
            age=body.age,
            gender=body.gender,
            phone=body.phone,
            address=body.address,
        ))
    elif role == UserRole.SPECIALIST:
        db.add(Specialist(
            user_id=user.id,
            rut=body.rut,
            specialty=body.specialty,
            phone=body.phone,
        ))
    elif role == UserRole.ADMIN:
        # Sin fila admin, GET /api/admins/me no tendría job_title/phone que editar.
        db.add(Admin(user_id=user.id))

    db.commit()
    db.refresh(user)

    return UserResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        role=user.role,
        temp_password=temp_password,
    )
