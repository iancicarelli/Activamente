"""SEC-14: scripts/create_admin.py crea el primer admin en una base sin admins y se niega a
crear un segundo. Cada test corre en la transacción del fixture `db`, así que borrar el admin
del seed no afecta a los demás tests."""

import pytest

from app.core.security import verify_password
from app.models.admin_model import Admin
from app.models.user_model import User, UserRole
from scripts import create_admin
from scripts.create_admin import BootstrapError, create_first_admin
from tests import seed_data
from tests.conftest import login

PASSWORD = "una-clave-larga-2026"


@pytest.fixture
def no_admins(db):
    """Base como la de producción recién creada: sin ningún ADMIN (el perfil cae por CASCADE)."""
    db.query(User).filter(User.role == UserRole.ADMIN).delete()
    db.flush()
    return db


def test_refuses_when_an_admin_already_exists(db):
    before = db.query(User).count()
    with pytest.raises(BootstrapError, match="Ya existe un administrador"):
        create_first_admin(db, "nuevo@activamente.cl", PASSWORD, "Nuevo")
    assert db.query(User).count() == before


def test_creates_admin_with_profile_and_can_login(client, no_admins):
    user = create_first_admin(no_admins, "  Jefa@ActivaMente.cl ", PASSWORD, " Paula ", "Rojas")

    assert user.role == UserRole.ADMIN
    assert user.email == "jefa@activamente.cl"
    assert user.first_name == "Paula"
    assert verify_password(PASSWORD, user.password_hash)
    assert no_admins.query(Admin).filter(Admin.user_id == user.id).one()

    token = login(client, email="jefa@activamente.cl", password=PASSWORD)
    r = client.get("/api/users?limit=1", headers={"Authorization": f"Bearer {token['access_token']}"})
    assert r.status_code == 200


def test_second_run_refuses(no_admins):
    create_first_admin(no_admins, "jefa@activamente.cl", PASSWORD, "Paula")
    with pytest.raises(BootstrapError, match="Ya existe un administrador"):
        create_first_admin(no_admins, "otra@activamente.cl", PASSWORD, "Otra")


@pytest.mark.parametrize(
    ("email", "password", "first_name", "error"),
    [
        ("no-es-un-email", PASSWORD, "Paula", "Email inválido"),
        ("jefa@activamente.cl", "corta", "Paula", "al menos 12"),
        ("jefa@activamente.cl", PASSWORD, "   ", "nombre es obligatorio"),
        (seed_data.SPECIALIST_EMAIL, PASSWORD, "Paula", "ya está registrado"),
    ],
)
def test_rejects_invalid_input_without_writing(no_admins, email, password, first_name, error):
    before = no_admins.query(User).count()
    with pytest.raises(BootstrapError, match=error):
        create_first_admin(no_admins, email, password, first_name)
    assert no_admins.query(User).count() == before


def test_main_reads_env_and_reports_errors(no_admins, monkeypatch, capsys):
    monkeypatch.setattr(create_admin, "SessionLocal", lambda: no_admins)
    monkeypatch.setenv("ADMIN_EMAIL", "jefa@activamente.cl")
    monkeypatch.setenv("ADMIN_FIRST_NAME", "Paula")
    monkeypatch.setenv("ADMIN_PASSWORD", PASSWORD)

    assert create_admin.main() == 0
    assert "Admin creado: jefa@activamente.cl" in capsys.readouterr().out

    assert create_admin.main() == 1  # ya hay un admin
    assert "Ya existe un administrador" in capsys.readouterr().err
