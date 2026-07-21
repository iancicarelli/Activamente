"""Smoke tests de autenticación: login por rol + credenciales inválidas +
cuenta desactivada (403)."""

from tests import seed_data


def test_login_admin_ok(client):
    r = client.post(
        "/api/auth/login",
        json={"email": seed_data.ADMIN_EMAIL, "password": seed_data.ADMIN_PASSWORD},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["access_token"]
    assert data["role"] == "ADMIN"


def test_login_specialist_ok(client):
    r = client.post(
        "/api/auth/login",
        json={"email": seed_data.SPECIALIST_EMAIL, "password": seed_data.SPECIALIST_PASSWORD},
    )
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "SPECIALIST"


def test_login_patient_ok_embeds_patient(client):
    r = client.post(
        "/api/auth/login",
        json={"email": seed_data.PATIENT_EMAIL, "password": seed_data.PATIENT_PASSWORD},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["role"] == "PATIENT"
    assert data["patient"] is not None
    assert data["patient"]["rut"] == seed_data.PATIENT_PEDRO_RUT


def test_login_wrong_password_401(client):
    r = client.post(
        "/api/auth/login",
        json={"email": seed_data.ADMIN_EMAIL, "password": "definitivamente-mal"},
    )
    assert r.status_code == 401


def test_deactivated_user_login_403(client, admin_headers):
    # El admin desactiva a Ana; su login debe dar 403 (no 401). Reactivamos al
    # final para no dejar estado sucio para otros tests.
    patch = f"/api/users/{seed_data.PATIENT_ANA_ID}/status"
    r = client.patch(patch, json={"is_active": False}, headers=admin_headers)
    assert r.status_code == 200, r.text
    try:
        r = client.post(
            "/api/auth/login",
            json={"email": seed_data.PATIENT_ANA_EMAIL, "password": seed_data.PATIENT_ANA_PASSWORD},
        )
        assert r.status_code == 403
    finally:
        r = client.patch(patch, json={"is_active": True}, headers=admin_headers)
        assert r.status_code == 200, r.text
