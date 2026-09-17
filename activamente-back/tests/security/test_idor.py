"""Seguridad · IDOR: acceder o modificar recursos de otro usando su id.
Complementa la matriz de `tests/test_authz.py` con los ids de segundo nivel
(session_exercises, encuestas, citas) y los cruces entre pacientes."""

from datetime import timedelta

from app.core.config import today_local
from tests import seed_data
from tests.helpers import routine_body

PEDRO, ANA = seed_data.PATIENT_PEDRO_ID, seed_data.PATIENT_ANA_ID
SESSION, SEID = seed_data.SESSION_ID, seed_data.SESSION_EXERCISE_ID


def test_other_patient_cannot_touch_pedros_session(client, ana_headers):
    assert client.get(f"/api/sessions/{SESSION}", headers=ana_headers).status_code == 403
    assert client.post(f"/api/sessions/{SESSION}/complete", headers=ana_headers).status_code == 403
    r = client.put(
        f"/api/sessions/{SESSION}/exercises/{SEID}", json={"series_completed": 1, "reps_completed": 1}, headers=ana_headers
    )
    assert r.status_code == 403
    pre = {"session_id": SESSION, "pain_level": 1, "fatigue_level": 1}
    assert client.post("/api/surveys/pre", json=pre, headers=ana_headers).status_code == 403
    assert client.post("/api/surveys/post", json={"session_id": SESSION, "mood_level": 5}, headers=ana_headers).status_code == 403


def test_patient_cannot_create_session_for_someone_else(client, ana_headers, patient_headers):
    # Ana manda patient_id de Pedro y la rutina de Pedro: el body se ignora y la rutina no es suya → 403.
    r = client.post("/api/sessions", json={"routine_id": seed_data.ROUTINE_ID, "patient_id": PEDRO}, headers=ana_headers)
    assert r.status_code == 403
    # Pedro con patient_id ajeno: se ignora, la sesión queda a su nombre.
    r = client.post("/api/sessions", json={"routine_id": seed_data.ROUTINE_ID, "patient_id": ANA}, headers=patient_headers)
    assert r.status_code == 201 and r.json()["patient_id"] == PEDRO


def test_session_exercise_from_another_session_is_404(client, patient_headers):
    other = client.post("/api/sessions", json={"routine_id": seed_data.ROUTINE_ID}, headers=patient_headers).json()
    foreign_seid = other["session_exercises"][0]["id"]
    body = {"series_completed": 1, "reps_completed": 1}
    r = client.put(f"/api/sessions/{SESSION}/exercises/{foreign_seid}", json=body, headers=patient_headers)
    assert r.status_code == 404


def test_specialist_cannot_reach_unassigned_patient_by_any_path(client, other_specialist_headers):
    h = other_specialist_headers
    assert client.get(f"/api/patients/{PEDRO}", headers=h).status_code == 403
    assert client.get(f"/api/appointments?patient_id={PEDRO}", headers=h).status_code == 403
    assert (
        client.post("/api/sessions", json={"routine_id": seed_data.ROUTINE_ID, "patient_id": PEDRO}, headers=h).status_code == 403
    )
    assert client.post("/api/routines", json=routine_body(PEDRO), headers=h).status_code == 403
    tomorrow = (today_local() + timedelta(days=1)).isoformat()
    appt = {"patient_id": PEDRO, "date": tomorrow, "time_slot": "09:00:00"}
    assert client.post("/api/appointments", json=appt, headers=h).status_code == 403
    # by-rut: existe pero no está asignado → sin historial.
    r = client.get(f"/api/patients/by-rut/{seed_data.PATIENT_PEDRO_RUT}", headers=h)
    assert r.status_code == 200 and r.json()["assignedToMe"] is False and r.json()["sessions"] in (None, [])


def test_specialist_cannot_edit_other_specialists_appointment(
    client, specialist_headers, other_specialist_headers, patient_headers
):
    tomorrow = (today_local() + timedelta(days=1)).isoformat()
    appt = client.post(
        "/api/appointments", json={"patient_id": PEDRO, "date": tomorrow, "time_slot": "11:00:00"}, headers=specialist_headers
    ).json()
    cancel = {"status": "CANCELLED"}
    assert (
        client.patch(f"/api/appointments/{appt['id']}/status", json=cancel, headers=other_specialist_headers).status_code == 404
    )
    assert client.patch(f"/api/appointments/{appt['id']}/status", json=cancel, headers=patient_headers).status_code == 403
    assert client.get("/api/appointments/next", headers=patient_headers).json()["id"] == appt["id"]


def test_patient_cannot_list_or_filter_other_patients(client, ana_headers, patient_headers):
    assert client.get("/api/patients/", headers=ana_headers).status_code == 403
    assert client.get(f"/api/appointments?patient_id={PEDRO}", headers=ana_headers).status_code == 403
    assert client.get(f"/api/routines?patient_id={PEDRO}", headers=ana_headers).status_code == 403
    # Pedro pidiendo sus propias citas con su id explícito sí puede.
    assert client.get(f"/api/appointments?patient_id={PEDRO}", headers=patient_headers).status_code == 200


def test_patient_cannot_use_staff_only_writes(client, patient_headers):
    h = patient_headers
    assert client.post("/api/patients/assign", json={"rut": seed_data.PATIENT_ANA_RUT}, headers=h).status_code == 403
    assert client.patch(f"/api/patients/{PEDRO}/status", json={"active": False}, headers=h).status_code == 403
    assert client.delete(f"/api/routines/{seed_data.ROUTINE_ID}", headers=h).status_code == 403
    assert client.put(f"/api/users/{PEDRO}/password", json={"new_password": "abcdef"}, headers=h).status_code == 403
    assert client.patch(f"/api/users/{PEDRO}", json={"fullName": "Hackeado Ya"}, headers=h).status_code == 403
