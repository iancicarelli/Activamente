"""Helpers compartidos por las capas e2e / security: crear usuarios reales por la
API (con contraseña temporal), loguear de verdad (bcrypt) y armar rutinas."""

from datetime import timedelta

from app.core.config import today_local

EXERCISES_TWO = [
    {"exercise_id": "squat", "order_index": 0, "level": 1, "total_series": 1, "total_reps": 5, "rest_time_seconds": 15},
    {"exercise_id": "shoulder_raises", "order_index": 1, "level": 1, "total_series": 1, "total_reps": 5},
]


def create_user(client, admin_headers, *, role: str, full_name: str, email: str, rut: str | None = None, **extra) -> dict:
    """POST /api/users como admin. Devuelve el JSON (incluye `temp_password`)."""
    body = {"fullName": full_name, "email": email, "role": role, **extra}
    if rut:
        body["rut"] = rut
    r = client.post("/api/users", json=body, headers=admin_headers)
    assert r.status_code == 201, f"crear usuario falló: {r.status_code} {r.text}"
    return r.json()


def real_login(client, **body) -> dict:
    """Login real (pasa por bcrypt). Devuelve el JSON del token."""
    r = client.post("/api/auth/login", json=body)
    assert r.status_code == 200, f"login falló: {r.status_code} {r.text}"
    return r.json()


def auth(token_json: dict) -> dict:
    return {"Authorization": f"Bearer {token_json['access_token']}"}


def accept_terms(client, headers: dict) -> None:
    """Lo que hace la app en el primer ingreso: leer los términos vigentes y aceptarlos."""
    terms = client.get("/api/me/terms", headers=headers)
    assert terms.status_code == 200, terms.text
    r = client.post("/api/me/terms", json={"version": terms.json()["version"]}, headers=headers)
    assert r.status_code == 204, r.text


def routine_body(patient_id: str, *, name: str = "Rutina e2e", days: int = 30, exercises=None) -> dict:
    """Rutina vigente desde hoy, todos los días, con dos ejercicios por defecto."""
    today = today_local()
    return {
        "patient_id": patient_id,
        "name": name,
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=days)).isoformat(),
        "days_of_week": [1, 2, 3, 4, 5, 6, 7],
        "exercises": exercises or EXERCISES_TWO,
    }
