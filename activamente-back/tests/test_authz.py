"""Matriz de autorización (TS-05): (rol, método, ruta, esperado). Es la red de
seguridad de EP-01..EP-04: si algo se abre por accidente, esto lo ve."""

import pytest

from tests import seed_data
from tests.conftest import bearer

PEDRO = seed_data.PATIENT_PEDRO_ID
ROUTINE = seed_data.ROUTINE_ID
SESSION = seed_data.SESSION_ID

ROLES = {
    "anon": None,
    "admin": (seed_data.ADMIN_ID, "ADMIN"),
    "specialist": (seed_data.SPECIALIST_ID, "SPECIALIST"),  # María, asignada a Pedro
    "other_specialist": (seed_data.SPECIALIST2_ID, "SPECIALIST"),  # Jorge, sin pacientes
    "patient": (seed_data.PATIENT_PEDRO_ID, "PATIENT"),
    "other_patient": (seed_data.PATIENT_ANA_ID, "PATIENT"),
}

# (método, ruta, body) → {rol: status esperado}. `ok` = 2xx.
MATRIX = [
    ("GET", "/api/users", None, {"anon": 401, "admin": 200, "specialist": 403, "patient": 403}),
    ("POST", "/api/users", {"fullName": "X Y", "email": "x@y.cl", "role": "paciente"}, {"specialist": 403, "patient": 403}),
    ("GET", "/api/patients/", None, {"anon": 401, "admin": 200, "specialist": 200, "patient": 403, "other_patient": 403}),
    (
        "GET",
        f"/api/patients/{PEDRO}",
        None,
        {"anon": 401, "admin": 200, "specialist": 200, "other_specialist": 403, "patient": 200, "other_patient": 403},
    ),
    ("GET", f"/api/patients/by-rut/{seed_data.PATIENT_PEDRO_RUT}", None, {"admin": 200, "specialist": 200, "patient": 403}),
    ("POST", "/api/patients/assign", {"rut": seed_data.PATIENT_ANA_RUT}, {"admin": 403, "patient": 403, "other_specialist": 200}),
    (
        "PATCH",
        f"/api/patients/{PEDRO}/status",
        {"active": True},
        {"admin": 200, "specialist": 200, "other_specialist": 403, "patient": 403, "other_patient": 403},
    ),
    ("GET", "/api/specialists/dashboard", None, {"anon": 401, "admin": 403, "specialist": 200, "patient": 403}),
    ("GET", "/api/specialists/me", None, {"admin": 403, "specialist": 200, "patient": 403}),
    ("GET", "/api/admins/me", None, {"admin": 200, "specialist": 403, "patient": 403}),
    ("GET", "/api/exercises", None, {"anon": 401, "admin": 200, "specialist": 200, "patient": 200}),
    (
        "GET",
        f"/api/routines?patient_id={PEDRO}",
        None,
        {"admin": 200, "specialist": 200, "other_specialist": 403, "patient": 200, "other_patient": 403},
    ),
    (
        "GET",
        f"/api/routines/active?patient_id={PEDRO}",
        None,
        {"specialist": 200, "other_specialist": 403, "patient": 200, "other_patient": 403},
    ),
    (
        "GET",
        f"/api/routines/next?patient_id={PEDRO}",
        None,
        {"specialist": 200, "other_specialist": 403, "patient": 200, "other_patient": 403},
    ),
    (
        "GET",
        f"/api/routines/{ROUTINE}",
        None,
        {"admin": 200, "specialist": 200, "other_specialist": 403, "patient": 200, "other_patient": 403},
    ),
    (
        "PUT",
        f"/api/routines/{ROUTINE}",
        {
            "name": "Rutina de prueba - sesiones",
            "start_date": "2026-01-01",
            "end_date": "2030-12-31",
            "days_of_week": [1, 2, 3, 4, 5, 6, 7],
            "exercises": [{"exercise_id": "squat", "order_index": 0}],
        },
        {"anon": 401, "admin": 403, "other_specialist": 403, "patient": 403, "other_patient": 403},
    ),
    (
        "PUT",
        f"/api/users/{PEDRO}/password",
        {"new_password": "Patient1234!"},
        {"anon": 401, "admin": 204, "specialist": 403, "patient": 403},
    ),
    ("DELETE", f"/api/routines/{ROUTINE}", None, {"other_specialist": 403, "patient": 403, "other_patient": 403}),
    (
        "GET",
        f"/api/sessions/{SESSION}",
        None,
        {"admin": 200, "specialist": 200, "other_specialist": 403, "patient": 200, "other_patient": 403},
    ),
    ("POST", f"/api/sessions/{SESSION}/complete", None, {"other_specialist": 403, "other_patient": 403, "patient": 200}),
    ("GET", "/api/patients/me/sessions", None, {"admin": 403, "specialist": 403, "patient": 200}),
    ("GET", "/api/appointments/next", None, {"admin": 403, "specialist": 403, "patient": 200}),
    ("GET", "/api/appointments/available-slots?date=2030-01-01", None, {"admin": 403, "specialist": 200, "patient": 403}),
    ("GET", "/api/appointments/calendar?from=2030-01-01&to=2030-01-31", None, {"specialist": 200, "patient": 403}),
    ("GET", "/api/appointments", None, {"anon": 401, "admin": 200, "specialist": 200, "patient": 200}),
    ("GET", "/api/me", None, {"anon": 401, "admin": 200, "specialist": 200, "patient": 200}),
]


def _cases():
    for method, path, body, expectations in MATRIX:
        for role, expected in expectations.items():
            yield pytest.param(method, path, body, role, expected, id=f"{role}:{method} {path}")


@pytest.mark.parametrize("method,path,body,role,expected", list(_cases()))
def test_authorization_matrix(client, method, path, body, role, expected):
    headers = bearer(*ROLES[role]) if ROLES[role] else {}
    r = client.request(method, path, json=body, headers=headers)
    assert r.status_code == expected, f"{role} {method} {path}: esperado {expected}, obtenido {r.status_code} {r.text}"
