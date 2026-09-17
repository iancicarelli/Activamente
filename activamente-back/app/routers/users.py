import secrets
import string
import unicodedata
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.core.rut import format_rut, is_valid_rut, normalize_rut, rut_column_normalized
from app.core.security import hash_password
from app.database import get_db
from app.models.admin_model import Admin
from app.models.patient_model import Patient
from app.models.specialist_model import Specialist
from app.models.user_model import User, UserRole
from app.schemas.user_schema import (
    AdminSetPasswordRequest,
    CreateUserRequest,
    UpdateUserRequest,
    UserListItem,
    UserListResponse,
    UserResponse,
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
    first_token = name.strip().split(" ")[0] if name and name.strip() else ""
    normalized = unicodedata.normalize("NFKD", first_token)
    ascii_only = "".join(c for c in normalized if c.isascii() and c.isalpha())
    base = ascii_only.capitalize() or "User"

    digits = "".join(secrets.choice(string.digits) for _ in range(3))
    symbol = secrets.choice(_TEMP_PASSWORD_SYMBOLS)
    return f"{base}{digits}{symbol}"


def _clean_rut(rut: str | None) -> str | None:
    """Normaliza y valida el RUT (EP-12). None/'' → None. Inválido → 422."""
    if rut is None or not normalize_rut(rut):
        return None
    if not is_valid_rut(rut):
        raise HTTPException(status_code=422, detail="El RUT no es válido (dígito verificador incorrecto).")
    return format_rut(rut)


def _assert_rut_free(db: Session, rut: str | None, exclude_user_id=None) -> None:
    if not rut:
        return
    clean = normalize_rut(rut)
    for model in (Patient, Specialist):
        q = db.query(model).filter(rut_column_normalized(model.rut) == clean)
        if exclude_user_id is not None:
            q = q.filter(model.user_id != exclude_user_id)
        if q.first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese RUT ya está registrado.")


def _profile_row(db: Session, user: User):
    if user.role == UserRole.PATIENT:
        return db.query(Patient).filter(Patient.user_id == user.id).first()
    if user.role == UserRole.SPECIALIST:
        return db.query(Specialist).filter(Specialist.user_id == user.id).first()
    return db.query(Admin).filter(Admin.user_id == user.id).first()


def _to_list_item(db: Session, user: User) -> UserListItem:
    row = _profile_row(db, user)
    return UserListItem(
        id=user.id,
        first_name=user.first_name or "",
        last_name=user.last_name or "",
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        rut=getattr(row, "rut", None),
        phone=getattr(row, "phone", None),
    )


@router.get("", response_model=UserListResponse)
def list_users(
    search: str | None = Query(None, description="Filtra por nombre o email"),
    role: str | None = Query(None, description="admin / especialista / paciente o enum"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Lista paginada: `{items, total, limit, offset}` (EP-11)."""
    query = db.query(User)

    if role:
        try:
            query = query.filter(User.role == role_from_str(role))
        except ValueError as err:
            raise HTTPException(status_code=422, detail=f"Rol inválido: {role}") from err

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.email.ilike(term),
                func.concat(User.first_name, " ", User.last_name).ilike(term),
            )
        )

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()

    # Una query por tabla de perfil (3 como máximo), no una por usuario.
    ids = [u.id for u in users]
    patients = {p.user_id: p for p in db.query(Patient).filter(Patient.user_id.in_(ids)).all()} if ids else {}
    specialists = {s.user_id: s for s in db.query(Specialist).filter(Specialist.user_id.in_(ids)).all()} if ids else {}
    admins = {a.user_id: a for a in db.query(Admin).filter(Admin.user_id.in_(ids)).all()} if ids else {}

    items = []
    for u in users:
        row = patients.get(u.id) or specialists.get(u.id) or admins.get(u.id)
        items.append(
            UserListItem(
                id=u.id,
                first_name=u.first_name or "",
                last_name=u.last_name or "",
                email=u.email,
                role=u.role,
                is_active=u.is_active,
                created_at=u.created_at,
                rut=getattr(row, "rut", None),
                phone=getattr(row, "phone", None),
            )
        )
    return UserListResponse(items=items, total=total, limit=limit, offset=offset)


@router.patch("/{user_id}/status", response_model=UserListItem)
def update_user_status(
    user_id: str,
    body: UserStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    if user.id == admin.id and not body.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes desactivar tu propia cuenta.")

    user.is_active = body.is_active
    db.commit()
    db.refresh(user)
    return _to_list_item(db, user)


@router.put("/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def set_user_password(
    user_id: UUID,
    body: AdminSetPasswordRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """El admin fija una contraseña nueva a cualquier usuario (sin pedir la actual).
    Los tokens vigentes siguen sirviendo hasta que venzan."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return None


@router.patch("/{user_id}", response_model=UserListItem)
def update_user(
    user_id: str,
    body: UpdateUserRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Edita nombre, email y datos de perfil de cualquier usuario (HC-09)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    data = body.model_dump(exclude_unset=True)

    if "fullName" in data and data["fullName"]:
        parts = data["fullName"].strip().split(" ", 1)
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else ""

    if "email" in data and data["email"]:
        email = data["email"].strip().lower()
        clash = db.query(User).filter(User.email == email, User.id != user.id).first()
        if clash:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese email ya está registrado.")
        user.email = email

    row = _profile_row(db, user)
    if row is None:
        row = {UserRole.PATIENT: Patient, UserRole.SPECIALIST: Specialist, UserRole.ADMIN: Admin}[user.role](user_id=user.id)
        db.add(row)

    if "rut" in data and user.role != UserRole.ADMIN:
        rut = _clean_rut(data["rut"])
        _assert_rut_free(db, rut, exclude_user_id=user.id)
        row.rut = rut
    for field in ("phone", "age", "gender", "address", "specialty", "job_title"):
        if field in data and hasattr(row, field):
            setattr(row, field, data[field])

    db.commit()
    db.refresh(user)
    return _to_list_item(db, user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    email = body.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ese email ya está registrado.")

    try:
        role = body.mapped_role()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    rut = _clean_rut(body.rut) if role != UserRole.ADMIN else None
    _assert_rut_free(db, rut)

    first_name, last_name = body.split_name()
    temp_password = _generate_temp_password(first_name)

    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password_hash=hash_password(temp_password),
        role=role,
    )
    db.add(user)
    db.flush()  # user.id antes de commitear

    if role == UserRole.PATIENT:
        db.add(Patient(user_id=user.id, rut=rut, age=body.age, gender=body.gender, phone=body.phone, address=body.address))
    elif role == UserRole.SPECIALIST:
        db.add(Specialist(user_id=user.id, rut=rut, specialty=body.specialty, phone=body.phone))
    else:
        db.add(Admin(user_id=user.id, phone=body.phone))

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
