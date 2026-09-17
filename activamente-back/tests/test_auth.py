"""Login por email y por RUT, credenciales inválidas, cuenta desactivada,
expiración por rol y cambio de contraseña."""

from tests import seed_data
from tests.conftest import login


def test_login_admin_ok(client):
    data = login(client, email=seed_data.ADMIN_EMAIL, password=seed_data.ADMIN_PASSWORD)
    assert data["access_token"]
    assert data["role"] == "ADMIN"
    assert data["expires_in"] == 60 * 60
    assert "patient" not in data


def test_login_specialist_ok(client):
    assert login(client, email=seed_data.SPECIALIST_EMAIL, password=seed_data.SPECIALIST_PASSWORD)["role"] == "SPECIALIST"


def test_login_patient_has_long_expiry(client):
    data = login(client, email=seed_data.PATIENT_EMAIL, password=seed_data.PATIENT_PASSWORD)
    assert data["role"] == "PATIENT"
    assert data["expires_in"] == 12 * 60 * 60


def test_login_by_rut_patient(client):
    data = login(client, rut="98.765.432-5", password=seed_data.PATIENT_PASSWORD)
    assert data["user_id"] == seed_data.PATIENT_PEDRO_ID


def test_login_by_rut_specialist(client):
    data = login(client, rut=seed_data.SPECIALIST_RUT, password=seed_data.SPECIALIST_PASSWORD)
    assert data["role"] == "SPECIALIST"


def test_login_email_is_case_insensitive(client):
    assert login(client, email="ADMIN@ActivaMente.cl", password=seed_data.ADMIN_PASSWORD)["role"] == "ADMIN"


def test_login_requires_identifier(client):
    r = client.post("/api/auth/login", json={"password": "x"})
    assert r.status_code == 422


def test_login_wrong_password_401(client):
    r = client.post("/api/auth/login", json={"email": seed_data.ADMIN_EMAIL, "password": "definitivamente-mal"})
    assert r.status_code == 401
    assert "contraseña" in r.json()["detail"]


def test_login_unknown_rut_401(client):
    r = client.post("/api/auth/login", json={"rut": "99999999-9", "password": "x"})
    assert r.status_code == 401


def test_deactivated_user_login_403_and_token_dies(client, admin_headers, ana_headers):
    r = client.patch(f"/api/users/{seed_data.PATIENT_ANA_ID}/status", json={"is_active": False}, headers=admin_headers)
    assert r.status_code == 200, r.text

    r = client.post("/api/auth/login", json={"email": seed_data.PATIENT_ANA_EMAIL, "password": seed_data.PATIENT_ANA_PASSWORD})
    assert r.status_code == 403

    # Un token emitido antes de la desactivación deja de servir.
    r = client.get("/api/me", headers=ana_headers)
    assert r.status_code == 403


def test_invalid_token_401(client):
    r = client.get("/api/me", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401


def test_change_password_flow(client, patient_headers):
    r = client.post(
        "/api/auth/change-password",
        json={"current_password": "incorrecta", "new_password": "Nueva1234!"},
        headers=patient_headers,
    )
    assert r.status_code == 400

    r = client.post(
        "/api/auth/change-password",
        json={"current_password": seed_data.PATIENT_PASSWORD, "new_password": "Nueva1234!"},
        headers=patient_headers,
    )
    assert r.status_code == 204

    login(client, email=seed_data.PATIENT_EMAIL, password="Nueva1234!")


def test_change_password_too_short_422(client, patient_headers):
    r = client.post(
        "/api/auth/change-password",
        json={"current_password": seed_data.PATIENT_PASSWORD, "new_password": "abc"},
        headers=patient_headers,
    )
    assert r.status_code == 422


def test_me_patient_includes_specialists(client, patient_headers):
    r = client.get("/api/me", headers=patient_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["role"] == "PATIENT"
    assert data["full_name"] == "Pedro Soto"
    assert data["patient"]["rut"] == seed_data.PATIENT_PEDRO_RUT
    names = [s["full_name"] for s in data["patient"]["specialists"]]
    assert "María González" in names


def test_me_specialist_counts_patients(client, specialist_headers):
    data = client.get("/api/me", headers=specialist_headers).json()
    assert data["specialist"]["total_patients"] == 1
    assert data["patient"] is None


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
