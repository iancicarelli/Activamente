from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.user_model import UserRole

# Maps frontend Spanish role names to backend enum values
_ROLE_MAP = {
    "paciente": UserRole.PATIENT,
    "especialista": UserRole.SPECIALIST,
    "admin": UserRole.ADMIN,
}


def role_from_str(value: str) -> UserRole:
    """Resolve a role from either a Spanish label or the enum value itself."""
    normalized = value.strip().lower()
    if normalized in _ROLE_MAP:
        return _ROLE_MAP[normalized]
    return UserRole(value.upper())


class CreateUserRequest(BaseModel):
    fullName: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role: str  # accepts 'paciente', 'especialista', 'PATIENT', 'SPECIALIST', etc.
    # Optional role-specific fields
    rut: str | None = None
    specialty: str | None = None
    phone: str | None = None
    age: int | None = Field(default=None, ge=0, le=120)
    gender: str | None = None
    address: str | None = None

    def mapped_role(self) -> UserRole:
        try:
            return role_from_str(self.role)
        except ValueError as err:
            raise ValueError(f"Rol inválido: {self.role}") from err

    def split_name(self) -> tuple[str, str]:
        parts = self.fullName.strip().split(" ", 1)
        first = parts[0]
        last = parts[1] if len(parts) > 1 else ""
        return first, last


class UpdateUserRequest(BaseModel):
    """PATCH /api/users/{id} (admin). Todos opcionales (HC-09 / BT-10)."""

    fullName: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    rut: str | None = None
    phone: str | None = None
    age: int | None = Field(default=None, ge=0, le=120)
    gender: str | None = None
    address: str | None = None
    specialty: str | None = None
    job_title: str | None = None


class UserResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str
    role: UserRole
    temp_password: str | None = None  # returned once at creation

    model_config = {"from_attributes": True}


class UserListItem(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime | None = None
    rut: str | None = None
    phone: str | None = None

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: list[UserListItem]
    total: int
    limit: int
    offset: int


class UserStatusUpdate(BaseModel):
    is_active: bool


class AdminSetPasswordRequest(BaseModel):
    """PUT /api/users/{id}/password: el admin fija la contraseña de otro usuario."""

    new_password: str = Field(min_length=6, max_length=128)
