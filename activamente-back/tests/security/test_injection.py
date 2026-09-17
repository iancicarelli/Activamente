"""Seguridad · inyección: SQL en búsquedas y login por RUT, comodines de LIKE y
caracteres raros. Ninguna entrada debe romper la API (500) ni abrir datos."""

import pytest

from tests import seed_data
from tests.helpers import routine_body

PAYLOADS = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "%' OR 1=1 --",
    "\\",
    "%",
    "_",
    "%%%",
    "ñandú 🦙",
    "<script>alert(1)</script>",
    "a" * 2000,
]


@pytest.mark.parametrize("payload", PAYLOADS)
def test_user_search_is_parameterized(client, admin_headers, payload):
    r = client.get("/api/users", params={"search": payload}, headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] >= len(data["items"])


@pytest.mark.parametrize("payload", PAYLOADS)
def test_patient_search_never_escapes_assignment(client, specialist_headers, other_specialist_headers, payload):
    """Aunque el comodín `%` matchee todo, un especialista solo ve a los suyos."""
    r = client.get("/api/patients/", params={"search": payload}, headers=specialist_headers)
    assert r.status_code == 200, r.text
    assert {p["id"] for p in r.json()} <= {seed_data.PATIENT_PEDRO_ID}
    r = client.get("/api/patients/", params={"search": payload}, headers=other_specialist_headers)
    assert r.status_code == 200 and r.json() == []


@pytest.mark.parametrize("rut", ["' OR 1=1 --", "98765432-5' --", "98765432-5 OR 1=1", "%", "1' UNION SELECT 1--"])
def test_login_by_rut_injection(client, rut):
    r = client.post("/api/auth/login", json={"rut": rut, "password": seed_data.PATIENT_PASSWORD})
    assert r.status_code in (401, 422), r.text


@pytest.mark.parametrize("rut", ["' OR 1=1 --", "%", "12345678-5'"])
def test_assign_and_by_rut_injection(client, specialist_headers, rut):
    assert client.post("/api/patients/assign", json={"rut": rut}, headers=specialist_headers).status_code in (404, 409, 422)
    assert client.get(f"/api/patients/by-rut/{rut}", headers=specialist_headers).status_code in (404, 422)


def test_role_filter_injection(client, admin_headers):
    r = client.get("/api/users", params={"role": "paciente' OR '1'='1"}, headers=admin_headers)
    assert r.status_code == 422


def test_stored_text_is_returned_verbatim_not_executed(client, specialist_headers):
    """La API es JSON: guarda el texto tal cual; el escape es responsabilidad del cliente."""
    body = routine_body(seed_data.PATIENT_PEDRO_ID, name="<img src=x onerror=alert(1)>")
    r = client.post("/api/routines", json=body, headers=specialist_headers)
    assert r.status_code == 201
    assert r.json()["name"] == "<img src=x onerror=alert(1)>"
    assert r.headers["content-type"].startswith("application/json")
