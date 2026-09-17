"""Humo: ¿la API arranca, responde y cada rol puede entrar? Sin crear datos.
Debe correr en ~2 s: `pytest -m smoke`."""

import pytest

from tests import seed_data
from tests.conftest import login


def test_root_and_health(client):
    assert client.get("/").json()["health"] == "/health"
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_openapi_lists_every_router(client):
    paths = client.get("/openapi.json").json()["paths"]
    for prefix in (
        "/api/auth",
        "/api/me",
        "/api/users",
        "/api/patients",
        "/api/specialists",
        "/api/admins",
        "/api/exercises",
        "/api/routines",
        "/api/sessions",
        "/api/surveys",
        "/api/appointments",
    ):
        assert any(p.startswith(prefix) for p in paths), f"falta el router {prefix}"
    assert client.get("/docs").status_code == 200


@pytest.mark.parametrize(
    "email,password,role",
    [
        (seed_data.ADMIN_EMAIL, seed_data.ADMIN_PASSWORD, "ADMIN"),
        (seed_data.SPECIALIST_EMAIL, seed_data.SPECIALIST_PASSWORD, "SPECIALIST"),
        (seed_data.PATIENT_EMAIL, seed_data.PATIENT_PASSWORD, "PATIENT"),
    ],
)
def test_login_and_me_per_role(client, email, password, role):
    data = login(client, email=email, password=password)
    assert data["role"] == role
    me = client.get("/api/me", headers={"Authorization": f"Bearer {data['access_token']}"})
    assert me.status_code == 200, me.text
    assert me.json()["role"] == role


def test_catalog_is_seeded(client, patient_headers):
    r = client.get("/api/exercises", headers=patient_headers)
    assert r.status_code == 200
    assert {e["id"] for e in r.json()} >= seed_data.EXERCISE_SLUGS


def test_patient_home_endpoints_answer(client, patient_headers):
    """Lo que la app pide al abrir el inicio del paciente."""
    for path in (
        f"/api/routines/active?patient_id={seed_data.PATIENT_PEDRO_ID}",
        f"/api/routines/next?patient_id={seed_data.PATIENT_PEDRO_ID}",
        "/api/appointments/next",
        "/api/patients/me/sessions",
    ):
        r = client.get(path, headers=patient_headers)
        assert r.status_code == 200, f"{path}: {r.status_code} {r.text}"


def test_specialist_home_endpoints_answer(client, specialist_headers):
    for path in ("/api/specialists/dashboard", "/api/patients/", "/api/specialists/me", "/api/appointments"):
        r = client.get(path, headers=specialist_headers)
        assert r.status_code == 200, f"{path}: {r.status_code} {r.text}"


def test_admin_home_endpoints_answer(client, admin_headers):
    for path in ("/api/users", "/api/admins/me", "/api/patients/"):
        r = client.get(path, headers=admin_headers)
        assert r.status_code == 200, f"{path}: {r.status_code} {r.text}"
