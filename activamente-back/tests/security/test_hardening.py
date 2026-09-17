"""Seguridad · hardening: política de contraseñas, entradas malformadas (nunca
500), cabeceras/CORS y fuga de datos sensibles en respuestas."""

import pytest

from tests import seed_data
from tests.conftest import bearer
from tests.helpers import routine_body

PEDRO = seed_data.PATIENT_PEDRO_ID
BAD_UUID = "not-a-uuid"
ZERO = "00000000-0000-0000-0000-000000000000"
NUL = chr(0)
RTL_OVERRIDE = chr(0x202E)


# ── Contraseñas ────────────────────────────────────────────────────────────────
def test_password_policy(client, admin_headers, patient_headers):
    for bad in ("", "12345"):
        body = {"current_password": seed_data.PATIENT_PASSWORD, "new_password": bad}
        r = client.post("/api/auth/change-password", json=body, headers=patient_headers)
        assert r.status_code == 422, (bad, r.text)
    assert client.put(f"/api/users/{PEDRO}/password", json={"new_password": "12345"}, headers=admin_headers).status_code == 422
    assert client.put(f"/api/users/{PEDRO}/password", json={"new_password": "x" * 129}, headers=admin_headers).status_code == 422
    body = {"current_password": "equivocada", "new_password": "Nueva123"}
    assert client.post("/api/auth/change-password", json=body, headers=patient_headers).status_code == 400


def test_password_change_invalidates_old_password(client, patient_headers):
    body = {"current_password": seed_data.PATIENT_PASSWORD, "new_password": "Nueva123"}
    assert client.post("/api/auth/change-password", json=body, headers=patient_headers).status_code == 204
    old = {"email": seed_data.PATIENT_EMAIL, "password": seed_data.PATIENT_PASSWORD}
    assert client.post("/api/auth/login", json=old).status_code == 401
    assert client.post("/api/auth/login", json={**old, "password": "Nueva123"}).status_code == 200


def test_temp_password_is_random_per_user(client, admin_headers):
    pws = set()
    for i in range(3):
        body = {"fullName": "Juan Pérez", "email": f"juan{i}@test.com", "role": "paciente"}
        pws.add(client.post("/api/users", json=body, headers=admin_headers).json()["temp_password"])
    assert len(pws) == 3


# ── Entradas malformadas: nunca 500 ────────────────────────────────────────────
@pytest.mark.parametrize(
    "method,path,body",
    [
        ("GET", f"/api/patients/{BAD_UUID}", None),
        ("PATCH", f"/api/patients/{BAD_UUID}/status", {"active": True}),
        ("GET", f"/api/routines/{BAD_UUID}", None),
        ("GET", f"/api/routines?patient_id={BAD_UUID}", None),
        ("GET", f"/api/routines/active?patient_id={BAD_UUID}", None),
        ("GET", f"/api/sessions/{BAD_UUID}", None),
        ("PUT", f"/api/sessions/{seed_data.SESSION_ID}/exercises/{BAD_UUID}", {"series_completed": 1, "reps_completed": 1}),
        ("PATCH", f"/api/users/{BAD_UUID}/status", {"is_active": True}),
        ("PATCH", f"/api/users/{BAD_UUID}", {"phone": "1"}),
        ("PUT", f"/api/users/{BAD_UUID}/password", {"new_password": "abcdef"}),
        ("DELETE", f"/api/patients/{BAD_UUID}/assign", None),
        ("PATCH", f"/api/appointments/{BAD_UUID}/status", {"status": "CANCELLED"}),
        ("GET", f"/api/appointments?patient_id={BAD_UUID}", None),
        ("GET", f"/api/patients/{ZERO}", None),
        ("GET", f"/api/sessions/{ZERO}", None),
        ("POST", "/api/sessions", {"routine_id": ZERO, "patient_id": PEDRO}),
        ("POST", "/api/surveys/pre", {"session_id": ZERO, "pain_level": 1, "fatigue_level": 1}),
    ],
)
def test_malformed_or_missing_ids_never_500(client, admin_headers, method, path, body):
    r = client.request(method, path, json=body, headers=admin_headers)
    assert r.status_code in (400, 403, 404, 422), f"{method} {path} → {r.status_code} {r.text}"


@pytest.mark.parametrize(
    "path,params",
    [
        ("/api/users", {"limit": 0}),
        ("/api/users", {"limit": 101}),
        ("/api/users", {"offset": -1}),
        ("/api/users", {"limit": "muchos"}),
        ("/api/patients/", {"limit": -5}),
        ("/api/appointments", {"date": "ayer"}),
        ("/api/appointments", {"from": "2030-13-45"}),
        ("/api/appointments/calendar", {"from": "2030-01-01", "to": "2030-12-31"}),  # > 3 meses
        ("/api/appointments/available-slots", {"date": "hoy"}),
        ("/api/routines/next", {}),  # sin patient_id
    ],
)
def test_bad_query_params_are_422_not_500(client, admin_headers, specialist_headers, path, params):
    headers = specialist_headers if path.startswith("/api/appointments") else admin_headers
    r = client.get(path, params=params, headers=headers)
    assert r.status_code in (400, 403, 404, 422), f"{path} {params} → {r.status_code} {r.text}"


@pytest.mark.parametrize(
    "path,content,ctype",
    [
        ("/api/auth/login", "{not json", "application/json"),
        ("/api/auth/login", "email=a&password=b", "application/x-www-form-urlencoded"),
        ("/api/auth/login", "[]", "application/json"),
        ("/api/auth/login", "null", "application/json"),
        ("/api/routines", '{"exercises": "nope"}', "application/json"),
    ],
)
def test_malformed_bodies_are_422(client, specialist_headers, path, content, ctype):
    r = client.post(path, content=content, headers={**specialist_headers, "Content-Type": ctype})
    assert r.status_code in (415, 422), f"{path}: {r.status_code} {r.text}"


@pytest.mark.parametrize("payload", ["x" * 10_000, "a" + NUL + "b", RTL_OVERRIDE + " reversed", "'; --"])
def test_weird_strings_in_bodies_never_500(client, admin_headers, specialist_headers, payload):
    body = {"fullName": payload, "email": "weird@test.com", "role": "paciente"}
    r = client.post("/api/users", json=body, headers=admin_headers)
    assert r.status_code in (201, 422), (repr(payload[:20]), r.status_code, r.text[:200])
    r = client.post("/api/routines", json=routine_body(PEDRO, name=payload[:120]), headers=specialist_headers)
    assert r.status_code in (201, 422), (repr(payload[:20]), r.status_code, r.text[:200])


def test_unknown_routes_and_methods(client, admin_headers):
    assert client.get("/api/nada", headers=admin_headers).status_code == 404
    assert client.delete("/api/users", headers=admin_headers).status_code == 405
    assert client.put("/api/auth/login", json={}).status_code == 405


# ── Cabeceras / CORS / exposición ─────────────────────────────────────────────
def test_cors_never_allows_credentials_with_wildcard(client):
    headers = {"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}
    r = client.options("/api/auth/login", headers=headers)
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "*"
    assert r.headers.get("access-control-allow-credentials") != "true"


def test_error_responses_hide_stack_traces(client):
    bad_json = client.post("/api/auth/login", content="{", headers={"Content-Type": "application/json"})
    for r in (client.get("/api/nada"), bad_json):
        assert "Traceback" not in r.text and 'File "' not in r.text


@pytest.mark.parametrize(
    "path,role,user_id",
    [
        ("/api/me", "PATIENT", PEDRO),
        (f"/api/patients/{PEDRO}", "ADMIN", seed_data.ADMIN_ID),
        ("/api/users", "ADMIN", seed_data.ADMIN_ID),
        ("/api/patients/", "ADMIN", seed_data.ADMIN_ID),
        (f"/api/patients/by-rut/{seed_data.PATIENT_PEDRO_RUT}", "ADMIN", seed_data.ADMIN_ID),
        ("/api/specialists/me", "SPECIALIST", seed_data.SPECIALIST_ID),
        (f"/api/sessions/{seed_data.SESSION_ID}", "PATIENT", PEDRO),
    ],
)
def test_responses_never_expose_password_hashes(client, path, role, user_id):
    r = client.get(path, headers=bearer(user_id, role))
    assert r.status_code == 200, r.text
    low = r.text.lower()
    assert "password" not in low and "$2b$" not in low and "hash" not in low
