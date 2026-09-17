"""
Fixtures de pytest: Postgres real de test + aislamiento por transacción (TS-01).

Cómo correr:
  1. docker compose up -d db          (desde la raíz; Postgres queda en 55432)
  2. pip install -r requirements-dev.txt
  3. cd activamente-back && TEST_DB_PORT=55432 pytest

La suite crea una base LIMPIA `activamente_test`, corre init.sql + seed.sql una
vez por sesión, y cada test corre dentro de una transacción externa que se hace
ROLLBACK al final: los `db.commit()` de la app solo liberan un SAVEPOINT
(`join_transaction_mode="create_savepoint"`), así ningún test ve lo que
escribió otro. Conexión configurable con TEST_DB_HOST/PORT/USER/PASSWORD o
TEST_DATABASE_URL.
"""

import os
from pathlib import Path

import psycopg2
import pytest

# SECRET_KEY y DATABASE_URL deben existir ANTES de importar la app.
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-prod")

DB_DIR = Path(__file__).resolve().parent.parent / "database"

TEST_DB_NAME = os.getenv("TEST_DB_NAME", "activamente_test")
DB_USER = os.getenv("TEST_DB_USER", "activamente")
DB_PASSWORD = os.getenv("TEST_DB_PASSWORD", "activamente")
DB_HOST = os.getenv("TEST_DB_HOST", "localhost")
DB_PORT = os.getenv("TEST_DB_PORT", "55432")

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{TEST_DB_NAME}",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

# Import DESPUÉS de fijar las env vars de arriba.
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import create_access_token  # noqa: E402
from app.database import get_db  # noqa: E402
from app.main import app  # noqa: E402
from tests import seed_data  # noqa: E402


def _admin_dsn() -> str:
    return f"dbname=postgres user={DB_USER} password={DB_PASSWORD} host={DB_HOST} port={DB_PORT}"


def _run_sql_file(conn, path: Path) -> None:
    with open(path, encoding="utf-8") as f:
        sql = f.read()
    with conn.cursor() as cur:
        cur.execute(sql)


@pytest.fixture(scope="session")
def _setup_test_database():
    admin_conn = psycopg2.connect(_admin_dsn())
    admin_conn.autocommit = True
    with admin_conn.cursor() as cur:
        cur.execute(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}"')
        cur.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')
    admin_conn.close()

    conn = psycopg2.connect(f"dbname={TEST_DB_NAME} user={DB_USER} password={DB_PASSWORD} host={DB_HOST} port={DB_PORT}")
    conn.autocommit = True
    _run_sql_file(conn, DB_DIR / "init.sql")
    _run_sql_file(conn, DB_DIR / "seed.sql")
    conn.close()

    yield

    admin_conn = psycopg2.connect(_admin_dsn())
    admin_conn.autocommit = True
    with admin_conn.cursor() as cur:
        cur.execute(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}"')
    admin_conn.close()


@pytest.fixture(scope="session")
def engine(_setup_test_database):
    engine = create_engine(TEST_DATABASE_URL)
    yield engine
    engine.dispose()


@pytest.fixture
def db(engine):
    """Sesión ORM envuelta en una transacción que se revierte al terminar el test."""
    connection = engine.connect()
    outer = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=True)
    try:
        yield session
    finally:
        session.close()
        outer.rollback()
        connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Capas del stack: marcador automático por carpeta (ver pytest.ini) ────────
_LAYER_BY_DIR = {"smoke": "smoke", "unit": "unit", "e2e": "e2e", "security": "security", "live": "live"}


def pytest_collection_modifyitems(config, items):
    for item in items:
        parent = Path(str(item.fspath)).parent.name
        layer = _LAYER_BY_DIR.get(parent, "integration")
        item.add_marker(getattr(pytest.mark, layer))


# ── Helpers de autenticación ────────────────────────────────────────────────
# Los tokens se firman directamente (sin pasar por bcrypt en cada test).


def bearer(user_id: str, role: str) -> dict:
    token, _ = create_access_token(user_id=user_id, role=role)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers():
    return bearer(seed_data.ADMIN_ID, "ADMIN")


@pytest.fixture
def specialist_headers():
    """María: tiene a Pedro asignado."""
    return bearer(seed_data.SPECIALIST_ID, "SPECIALIST")


@pytest.fixture
def other_specialist_headers():
    """Jorge: sin pacientes asignados."""
    return bearer(seed_data.SPECIALIST2_ID, "SPECIALIST")


@pytest.fixture
def patient_headers():
    """Pedro: con rutina y asignado a María."""
    return bearer(seed_data.PATIENT_PEDRO_ID, "PATIENT")


@pytest.fixture
def ana_headers():
    """Ana: paciente sin asignar, sin rutina."""
    return bearer(seed_data.PATIENT_ANA_ID, "PATIENT")


def login(client, **body) -> dict:
    r = client.post("/api/auth/login", json=body)
    assert r.status_code == 200, f"login falló: {r.status_code} {r.text}"
    return r.json()
