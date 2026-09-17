"""Seguridad · mass assignment y escalada por el body: campos que no deberían
poder escribirse se ignoran, sin importar el rol."""

from tests import seed_data
from tests.conftest import bearer
from tests.helpers import routine_body

ZERO = "00000000-0000-0000-0000-000000000000"


def test_create_user_ignores_privileged_fields(client, admin_headers):
    body = {
        "fullName": "Mass Assign",
        "email": "mass@test.com",
        "role": "paciente",
        "is_active": False,
        "password_hash": "x",
        "id": seed_data.ADMIN_ID,
        "temp_password": "Elegida1!",
    }
    r = client.post("/api/users", json=body, headers=admin_headers)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["id"] != seed_data.ADMIN_ID
    assert data["temp_password"] != "Elegida1!"
    listed = client.get("/api/users?search=mass@test.com", headers=admin_headers).json()["items"][0]
    assert listed["is_active"] is True


def test_patch_user_cannot_change_role_or_password(client, admin_headers):
    body = {"role": "ADMIN", "password_hash": "x", "is_active": False, "phone": "+56900000000"}
    r = client.patch(f"/api/users/{seed_data.PATIENT_ANA_ID}", json=body, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "PATIENT" and r.json()["is_active"] is True and r.json()["phone"] == "+56900000000"
    assert client.get("/api/users", headers=bearer(seed_data.PATIENT_ANA_ID, "PATIENT")).status_code == 403
    login = {"email": seed_data.PATIENT_ANA_EMAIL, "password": seed_data.PATIENT_ANA_PASSWORD}
    assert client.post("/api/auth/login", json=login).status_code == 200


def test_specialist_me_cannot_touch_account_fields(client, specialist_headers):
    body = {"specialty": "Fisiatría", "is_active": False, "user_id": seed_data.ADMIN_ID, "email": "otro@x.cl", "rut": "1-9"}
    r = client.patch("/api/specialists/me", json=body, headers=specialist_headers)
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["specialty"] == "Fisiatría" and me["is_active"] is True
    assert me["email"] == seed_data.SPECIALIST_EMAIL and me["rut"] == seed_data.SPECIALIST_RUT


def test_admin_me_cannot_touch_account_fields(client, admin_headers):
    r = client.patch("/api/admins/me", json={"job_title": "Jefe", "is_active": False, "role": "PATIENT"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert client.get("/api/me", headers=admin_headers).json()["role"] == "ADMIN"


def test_routine_update_cannot_move_patient(client, specialist_headers):
    body = {k: v for k, v in routine_body(seed_data.PATIENT_PEDRO_ID).items() if k != "patient_id"}
    body["patient_id"] = seed_data.PATIENT_ANA_ID
    body["specialist_id"] = seed_data.SPECIALIST2_ID
    r = client.put(f"/api/routines/{seed_data.ROUTINE_ID}", json=body, headers=specialist_headers)
    assert r.status_code == 200, r.text
    assert r.json()["patient_id"] == seed_data.PATIENT_PEDRO_ID and r.json()["specialist_id"] == seed_data.SPECIALIST_ID


def test_session_exercise_update_cannot_change_session_or_exercise(client, patient_headers):
    body = {"series_completed": 1, "reps_completed": 2, "session_id": ZERO, "exercise_id": "toe_touch", "id": ZERO}
    r = client.put(
        f"/api/sessions/{seed_data.SESSION_ID}/exercises/{seed_data.SESSION_EXERCISE_ID}", json=body, headers=patient_headers
    )
    assert r.status_code == 200, r.text
    assert r.json()["id"] == seed_data.SESSION_EXERCISE_ID and r.json()["session_id"] == seed_data.SESSION_ID
    assert r.json()["exercise_id"] == "squat"


def test_survey_cannot_set_type_or_id(client, patient_headers):
    body = {
        "session_id": seed_data.SESSION_ID,
        "pain_level": 1,
        "fatigue_level": 1,
        "type": "POST_SESSION",
        "id": seed_data.ADMIN_ID,
    }
    r = client.post("/api/surveys/pre", json=body, headers=patient_headers)
    assert r.status_code == 201 and r.json()["type"] == "PRE_SESSION" and r.json()["id"] != seed_data.ADMIN_ID
