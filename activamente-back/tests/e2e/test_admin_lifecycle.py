"""E2E: ciclo de vida de una cuenta desde el admin: alta → búsqueda → edición
→ bloqueo (login 403 y token vivo muere) → reactivación → clave nueva → entra."""

from tests.conftest import bearer
from tests.helpers import accept_terms, auth, create_user, real_login


def test_account_lifecycle(client, admin_headers):
    u = create_user(
        client, admin_headers, role="paciente", full_name="Carlos Vega", email="carlos.e2e@test.com", rut="9.876.543-3", age=68
    )
    temp = u["temp_password"]

    # Alta duplicada: email y RUT únicos.
    dup = client.post(
        "/api/users", json={"fullName": "Otro", "email": "CARLOS.e2e@test.com", "role": "paciente"}, headers=admin_headers
    )
    assert dup.status_code == 409
    dup = client.post(
        "/api/users",
        json={"fullName": "Otro", "email": "otro.e2e@test.com", "role": "paciente", "rut": "9876543-3"},
        headers=admin_headers,
    )
    assert dup.status_code == 409

    # Búsqueda paginada.
    found = client.get("/api/users?search=vega&role=paciente&limit=5", headers=admin_headers).json()
    assert found["total"] == 1 and found["items"][0]["id"] == u["id"] and found["items"][0]["rut"] == "9876543-3"

    # Edición: nombre, email, RUT y teléfono.
    r = client.patch(
        f"/api/users/{u['id']}",
        json={"fullName": "Carlos Andrés Vega", "email": "cvega.e2e@test.com", "rut": "12.345.678-5", "phone": "+56911111111"},
        headers=admin_headers,
    )
    assert r.status_code == 409  # RUT de María
    r = client.patch(
        f"/api/users/{u['id']}",
        json={"fullName": "Carlos Andrés Vega", "email": "cvega.e2e@test.com", "phone": "+56911111111"},
        headers=admin_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["first_name"] == "Carlos" and r.json()["last_name"] == "Andrés Vega" and r.json()["phone"] == "+56911111111"

    # Entra con el email nuevo y la clave temporal.
    tok = real_login(client, email="cvega.e2e@test.com", password=temp)
    # Primer ingreso: sin aceptar los términos la API no le sirve (403 + X-Terms-Required).
    r = client.get("/api/me", headers=auth(tok))
    assert r.status_code == 403 and r.headers["X-Terms-Required"] == "1"
    accept_terms(client, auth(tok))
    assert client.get("/api/me", headers=auth(tok)).status_code == 200

    # Bloqueo: login 403 y el token vivo deja de servir.
    r = client.patch(f"/api/users/{u['id']}/status", json={"is_active": False}, headers=admin_headers)
    assert r.status_code == 200 and r.json()["is_active"] is False
    assert client.post("/api/auth/login", json={"email": "cvega.e2e@test.com", "password": temp}).status_code == 403
    assert client.get("/api/me", headers=auth(tok)).status_code == 403
    assert client.get("/api/me", headers=bearer(u["id"], "PATIENT")).status_code == 403

    # Reactivar y fijar una clave nueva sin pedir la anterior.
    assert client.patch(f"/api/users/{u['id']}/status", json={"is_active": True}, headers=admin_headers).status_code == 200
    assert (
        client.put(f"/api/users/{u['id']}/password", json={"new_password": "ClaveNueva9"}, headers=admin_headers).status_code
        == 204
    )
    assert client.post("/api/auth/login", json={"email": "cvega.e2e@test.com", "password": temp}).status_code == 401
    assert real_login(client, email="cvega.e2e@test.com", password="ClaveNueva9")["user_id"] == u["id"]

    # Un admin no puede desactivarse a sí mismo.
    me = client.get("/api/admins/me", headers=admin_headers)
    assert me.status_code == 200
    from tests import seed_data

    assert (
        client.patch(f"/api/users/{seed_data.ADMIN_ID}/status", json={"is_active": False}, headers=admin_headers).status_code
        == 400
    )
