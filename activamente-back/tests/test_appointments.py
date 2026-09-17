"""Citas (TS-03): slots, crear (validaciones, 409), next, listar por rol,
rango from/to, calendario, cambio de estado."""

from datetime import date, timedelta

from tests import seed_data

TOMORROW = (date.today() + timedelta(days=1)).isoformat()
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()


def _create(client, headers, **overrides):
    body = {"patient_id": seed_data.PATIENT_PEDRO_ID, "date": TOMORROW, "time_slot": "10:00:00"}
    body.update(overrides)
    return client.post("/api/appointments", json=body, headers=headers)


def test_available_slots(client, specialist_headers):
    r = client.get(f"/api/appointments/available-slots?date={TOMORROW}", headers=specialist_headers)
    assert r.status_code == 200, r.text
    slots = r.json()["slots"]
    assert slots[0] == {"time": "08:00", "available": True}
    assert slots[-1]["time"] == "19:30"
    assert len(slots) == 24

    _create(client, specialist_headers)
    slots = client.get(f"/api/appointments/available-slots?date={TOMORROW}", headers=specialist_headers).json()["slots"]
    assert next(s for s in slots if s["time"] == "10:00")["available"] is False


def test_create_appointment_ok_and_clash(client, specialist_headers):
    r = _create(client, specialist_headers, notes="  Control mensual ")
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["patient_name"] == "Pedro Soto"
    assert data["specialist_name"] == "María González"
    assert data["status"] == "CONFIRMED"
    assert data["notes"] == "Control mensual"

    assert _create(client, specialist_headers).status_code == 409


def test_create_appointment_validations(client, specialist_headers, other_specialist_headers, patient_headers):
    assert _create(client, specialist_headers, date=YESTERDAY).status_code == 422
    assert _create(client, specialist_headers, time_slot="10:15:00").status_code == 422
    assert _create(client, specialist_headers, time_slot="21:00:00").status_code == 422
    assert _create(client, other_specialist_headers).status_code == 403  # no asignado
    assert _create(client, specialist_headers, patient_id="00000000-0000-0000-0000-000000000000").status_code == 404
    assert _create(client, patient_headers).status_code == 403


def test_next_appointment_for_patient(client, specialist_headers, patient_headers, ana_headers):
    assert client.get("/api/appointments/next", headers=patient_headers).json() is None
    _create(client, specialist_headers, time_slot="15:00:00")
    _create(client, specialist_headers, time_slot="09:00:00")
    data = client.get("/api/appointments/next", headers=patient_headers).json()
    assert data["time_slot"] == "09:00:00"
    assert client.get("/api/appointments/next", headers=ana_headers).json() is None
    assert client.get("/api/appointments/next", headers=specialist_headers).status_code == 403


def test_list_appointments_by_role_and_range(
    client, specialist_headers, other_specialist_headers, patient_headers, ana_headers, admin_headers
):
    _create(client, specialist_headers)
    in_10 = (date.today() + timedelta(days=10)).isoformat()
    _create(client, specialist_headers, date=in_10)

    assert len(client.get(f"/api/appointments?date={TOMORROW}", headers=specialist_headers).json()) == 1
    assert len(client.get("/api/appointments", headers=other_specialist_headers).json()) == 0
    assert len(client.get("/api/appointments", headers=patient_headers).json()) == 2
    assert len(client.get("/api/appointments", headers=ana_headers).json()) == 0
    assert len(client.get("/api/appointments", headers=admin_headers).json()) >= 2
    assert len(client.get(f"/api/appointments?from={TOMORROW}&to={TOMORROW}", headers=specialist_headers).json()) == 1
    # Filtrar por paciente ajeno → 403.
    assert (
        client.get(f"/api/appointments?patient_id={seed_data.PATIENT_PEDRO_ID}", headers=other_specialist_headers).status_code
        == 403
    )


def test_calendar_counts(client, specialist_headers):
    _create(client, specialist_headers, time_slot="10:00:00")
    _create(client, specialist_headers, time_slot="11:00:00")
    r = client.get(f"/api/appointments/calendar?from={TOMORROW}&to={TOMORROW}", headers=specialist_headers)
    assert r.status_code == 200, r.text
    assert r.json() == [{"date": TOMORROW, "count": 2}]
    far = (date.today() + timedelta(days=200)).isoformat()
    assert client.get(f"/api/appointments/calendar?from={TOMORROW}&to={far}", headers=specialist_headers).status_code == 422


def test_update_status_frees_slot(client, specialist_headers, other_specialist_headers, patient_headers):
    appt_id = _create(client, specialist_headers).json()["id"]
    url = f"/api/appointments/{appt_id}/status"
    assert client.patch(url, json={"status": "CANCELLED"}, headers=other_specialist_headers).status_code == 404
    assert client.patch(url, json={"status": "CANCELLED"}, headers=patient_headers).status_code == 403
    r = client.patch(url, json={"status": "CANCELLED"}, headers=specialist_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "CANCELLED"
    # El cupo se libera y el paciente ya no la ve como próxima.
    assert _create(client, specialist_headers).status_code == 201
    assert client.patch(url, json={"status": "PERDIDA"}, headers=specialist_headers).status_code == 422
