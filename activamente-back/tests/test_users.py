"""Admin: crear usuarios (temp_password, 409 email/RUT, DV inválido), listar
con búsqueda/rol/paginación, editar, activar/desactivar, perfiles /me."""

from tests import seed_data
from tests.conftest import login


def _create(client, admin_headers, **overrides):
    body = {"fullName": "Luis Alberto Rojas", "email": "luis.rojas@test.com", "role": "paciente", "rut": "15.123.456-9"}
    body.update(overrides)
    return client.post("/api/users", json=body, headers=admin_headers)


def test_create_patient_returns_temp_password_and_can_login(client, admin_headers):
    r = _create(client, admin_headers)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["first_name"] == "Luis"
    assert data["last_name"] == "Alberto Rojas"
    assert data["temp_password"].startswith("Luis")

    login(client, email="luis.rojas@test.com", password=data["temp_password"])
    # El RUT se guardó normalizado y sirve para loguearse.
    login(client, rut="15123456-9", password=data["temp_password"])


def test_create_user_duplicate_email_409(client, admin_headers):
    r = _create(client, admin_headers, email=seed_data.PATIENT_EMAIL, rut="16.456.789-3")
    assert r.status_code == 409


def test_create_user_duplicate_rut_409(client, admin_headers):
    r = _create(client, admin_headers, rut="98765432-5")  # el de Pedro
    assert r.status_code == 409


def test_create_user_invalid_rut_dv_422(client, admin_headers):
    r = _create(client, admin_headers, rut="15123456-0")
    assert r.status_code == 422


def test_create_user_invalid_role_422(client, admin_headers):
    r = _create(client, admin_headers, role="jefe")
    assert r.status_code == 422


def test_create_specialist_creates_row(client, admin_headers):
    r = _create(client, admin_headers, email="kine@test.com", role="especialista", rut="17.111.111-0", specialty="Kinesiología")
    assert r.status_code == 201, r.text
    token = login(client, email="kine@test.com", password=r.json()["temp_password"])["access_token"]
    me = client.get("/api/specialists/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["specialty"] == "Kinesiología"
    assert me["rut"] == "17111111-0"


def test_list_users_paginated(client, admin_headers):
    r = client.get("/api/users?limit=2", headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["items"]) == 2
    assert data["total"] >= 5
    assert data["limit"] == 2

    r = client.get("/api/users?role=paciente", headers=admin_headers)
    assert {u["role"] for u in r.json()["items"]} == {"PATIENT"}

    r = client.get("/api/users?search=pedro soto", headers=admin_headers)
    assert [u["email"] for u in r.json()["items"]] == [seed_data.PATIENT_EMAIL]

    r = client.get("/api/users?role=jefe", headers=admin_headers)
    assert r.status_code == 422


def test_admin_cannot_deactivate_self(client, admin_headers):
    r = client.patch(f"/api/users/{seed_data.ADMIN_ID}/status", json={"is_active": False}, headers=admin_headers)
    assert r.status_code == 400


def test_update_user(client, admin_headers):
    r = client.patch(
        f"/api/users/{seed_data.PATIENT_ANA_ID}",
        json={"fullName": "Ana María Pérez", "phone": "+56900000000", "rut": "11.111.111-1"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["first_name"] == "Ana"
    assert r.json()["last_name"] == "María Pérez"
    assert r.json()["phone"] == "+56900000000"

    r = client.patch(f"/api/users/{seed_data.PATIENT_ANA_ID}", json={"email": seed_data.PATIENT_EMAIL}, headers=admin_headers)
    assert r.status_code == 409

    r = client.patch(f"/api/users/{seed_data.PATIENT_ANA_ID}", json={"rut": "98765432-5"}, headers=admin_headers)
    assert r.status_code == 409


def test_update_user_not_found(client, admin_headers):
    r = client.patch("/api/users/00000000-0000-0000-0000-000000000000", json={"phone": "1"}, headers=admin_headers)
    assert r.status_code == 404


def test_admin_profile_upsert(client, admin_headers):
    r = client.patch("/api/admins/me", json={"job_title": "Jefe", "phone": "123"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    r = client.get("/api/admins/me", headers=admin_headers)
    assert r.json()["job_title"] == "Jefe"


def test_specialist_profile_patch(client, specialist_headers):
    r = client.patch("/api/specialists/me", json={"specialty": "Fisiatría"}, headers=specialist_headers)
    assert r.status_code == 200
    assert client.get("/api/specialists/me", headers=specialist_headers).json()["specialty"] == "Fisiatría"


def test_admin_sets_user_password(client, admin_headers, specialist_headers):
    url = f"/api/users/{seed_data.PATIENT_ANA_ID}/password"
    assert client.put(url, json={"new_password": "123"}, headers=admin_headers).status_code == 422
    assert client.put(url, json={"new_password": "Nueva1234"}, headers=specialist_headers).status_code == 403
    assert client.put(url, json={"new_password": "Nueva1234"}, headers=admin_headers).status_code == 204

    login(client, email=seed_data.PATIENT_ANA_EMAIL, password="Nueva1234")
    old = client.post("/api/auth/login", json={"email": seed_data.PATIENT_ANA_EMAIL, "password": seed_data.PATIENT_ANA_PASSWORD})
    assert old.status_code == 401

    missing = "/api/users/00000000-0000-0000-0000-000000000000/password"
    assert client.put(missing, json={"new_password": "Nueva1234"}, headers=admin_headers).status_code == 404
