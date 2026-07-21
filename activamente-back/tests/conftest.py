"""
Fixtures de pytest (estrategia B1: Postgres real de test).

Cómo correr los tests:
  1. Levantá Postgres (basta el servicio db):  docker compose up -d db
  2. Instalá las deps de test:                 pip install -r requirements-dev.txt
  3. Corré desde activamente-back/:            pytest

La suite crea una base LIMPIA `activamente_test` (separada de la de desarrollo),
le corre `database/init.sql` + `database/seed.sql`, y apunta la app a ella. Se
borra al terminar. Podés overridear conexión con TEST_DB_HOST/PORT/USER/PASSWORD
o directamente TEST_DATABASE_URL.
"""

import os
from pathlib import Path

import psycopg2
import pytest

# ── SECRET_KEY debe existir ANTES de importar la app (core/security.py falla
#    al arrancar si no está). Igual pasa con DATABASE_URL para el engine default.
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-prod")

DB_DIR = Path(__file__).resolve().parent.parent / "database"

TEST_DB_NAME = os.getenv("TEST_DB_NAME", "activamente_test")
DB_USER = os.getenv("TEST_DB_USER", "activamente")
DB_PASSWORD = os.getenv("TEST_DB_PASSWORD", "change_me")
DB_HOST = os.getenv("TEST_DB_HOST", "localhost")
DB_PORT = os.getenv("TEST_DB_PORT", "5432")

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{TEST_DB_NAME}",
)
# La app lee DATABASE_URL al importar database.py; la apuntamos a la de test.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

# Import DESPUÉS de fijar las env vars de arriba.
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.database import get_db  # noqa: E402

from tests import seed_data  # noqa: E402


def _admin_dsn() -> str:
    # Conexión a la base 'postgres' para crear/borrar la base de test.
    return f"dbname=postgres user={DB_USER} password={DB_PASSWORD} host={DB_HOST} port={DB_PORT}"


def _run_sql_file(conn, path: Path) -> None:
    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()
    with conn.cursor() as cur:
        cur.execute(sql)


@pytest.fixture(scope="session")
def _setup_test_database():
    # 1. (Re)crear la base de test desde cero.
    admin_conn = psycopg2.connect(_admin_dsn())
    admin_conn.autocommit = True
    with admin_conn.cursor() as cur:
        cur.execute(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}"')
        cur.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')
    admin_conn.close()

    # 2. Cargar esquema (init.sql) + datos de prueba (seed.sql).
    conn = psycopg2.connect(
        f"dbname={TEST_DB_NAME} user={DB_USER} password={DB_PASSWORD} host={DB_HOST} port={DB_PORT}"
    )
    conn.autocommit = True
    _run_sql_file(conn, DB_DIR / "init.sql")
    _run_sql_file(conn, DB_DIR / "seed.sql")
    conn.close()

    yield

    # 3. Limpieza: borrar la base de test.
    admin_conn = psycopg2.connect(_admin_dsn())
    admin_conn.autocommit = True
    with admin_conn.cursor() as cur:
        cur.execute(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}"')
    admin_conn.close()


@pytest.fixture(scope="session")
def client(_setup_test_database):
    engine = create_engine(TEST_DATABASE_URL)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    engine.dispose()


# ── Helpers de autenticación ────────────────────────────────────────────────


def _auth_headers(client, email: str, password: str) -> dict:
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login falló para {email}: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def admin_headers(client):
    return _auth_headers(client, seed_data.ADMIN_EMAIL, seed_data.ADMIN_PASSWORD)


@pytest.fixture
def specialist_headers(client):
    return _auth_headers(client, seed_data.SPECIALIST_EMAIL, seed_data.SPECIALIST_PASSWORD)


@pytest.fixture
def patient_headers(client):
    return _auth_headers(client, seed_data.PATIENT_EMAIL, seed_data.PATIENT_PASSWORD)
