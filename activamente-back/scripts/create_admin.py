"""Crea el PRIMER administrador en una base sin admins (SEC-14).

`POST /api/users` exige un admin, así que en una base recién creada (sin seed, SEC-13) nadie
puede entrar. Este script se corre UNA vez, a mano, tras el primer despliegue:

    docker compose -f docker-compose.yml exec backend python -m scripts.create_admin

Pide email, nombre y contraseña por teclado (la contraseña sin eco). Para uso no interactivo lee
ADMIN_EMAIL, ADMIN_FIRST_NAME, ADMIN_LAST_NAME y ADMIN_PASSWORD, pero la contraseña en una
variable de entorno queda en el historial de la shell: preferir el modo interactivo.

Aborta si ya existe cualquier usuario ADMIN: no sirve para crear un segundo admin ni para
"recuperar" uno (eso se hace desde la app, con un admin existente).
"""

import getpass
import os
import sys

from email_validator import EmailNotValidError, validate_email
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.database import SessionLocal
from app.models.admin_model import Admin
from app.models.user_model import User, UserRole

MIN_PASSWORD_LENGTH = 12


class BootstrapError(Exception):
    """Motivo por el que no se creó el admin, con un mensaje apto para la consola."""


def create_first_admin(db: Session, email: str, password: str, first_name: str, last_name: str = "") -> User:
    if db.query(User).filter(User.role == UserRole.ADMIN).first():
        raise BootstrapError("Ya existe un administrador. Crea los demás desde la app con esa cuenta.")

    try:
        email = validate_email(email.strip(), check_deliverability=False).normalized.lower()
    except EmailNotValidError as e:
        raise BootstrapError(f"Email inválido: {e}") from e
    first_name = first_name.strip()
    if not first_name:
        raise BootstrapError("El nombre es obligatorio.")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise BootstrapError(f"La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres.")
    if db.query(User).filter(User.email == email).first():
        raise BootstrapError("Ese email ya está registrado con otro rol.")

    user = User(
        first_name=first_name,
        last_name=last_name.strip(),
        email=email,
        password_hash=hash_password(password),
        role=UserRole.ADMIN,
    )
    db.add(user)
    db.flush()  # user.id antes de crear el perfil
    db.add(Admin(user_id=user.id, job_title="Administrador de Plataforma"))
    db.commit()
    db.refresh(user)
    return user


def _read_password() -> str:
    password = os.getenv("ADMIN_PASSWORD")
    if password:
        return password
    password = getpass.getpass(f"Contraseña (mínimo {MIN_PASSWORD_LENGTH} caracteres): ")
    if getpass.getpass("Repite la contraseña: ") != password:
        raise BootstrapError("Las contraseñas no coinciden.")
    return password


def main() -> int:
    try:
        email = os.getenv("ADMIN_EMAIL") or input("Email del admin: ")
        first_name = os.getenv("ADMIN_FIRST_NAME") or input("Nombre: ")
        last_name = os.getenv("ADMIN_LAST_NAME") or ("" if os.getenv("ADMIN_FIRST_NAME") else input("Apellido (opcional): "))
        password = _read_password()
        db = SessionLocal()
        try:
            user = create_first_admin(db, email, password, first_name, last_name)
        finally:
            db.close()
    except BootstrapError as e:
        print(f"No se creó el admin: {e}", file=sys.stderr)
        return 1
    print(f"Admin creado: {user.email} ({user.id}). Ya puedes entrar a la app con esa cuenta.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
