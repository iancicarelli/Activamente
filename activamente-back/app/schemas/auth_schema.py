from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models.user_model import UserRole


class LoginRequest(BaseModel):
    """Login por email o por RUT (R-05). Exactamente uno de los dos."""

    email: EmailStr | None = None
    rut: str | None = None
    password: str = Field(min_length=1)

    @model_validator(mode="after")
    def _one_identifier(self):
        if not self.email and not self.rut:
            raise ValueError("Ingresa tu email o tu RUT.")
        return self


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: UUID
    expires_in: int  # segundos
