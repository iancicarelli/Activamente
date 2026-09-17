"""Pacientes: lista filtrada por asignación (EP-01), alertas sin N+1, ficha,
by-rut, asignar/desasignar, deshabilitar = bloquear cuenta (R-01), /me/sessions."""

from tests import seed_data


def test_specialist_lists_only_assigned(client, specialist_headers):
    r = client.get("/api/patients/", headers=specialist_headers)
    assert r.status_code == 200, r.text
    ids = {p["id"] for p in r.json()}
    assert ids == {seed_data.PATIENT_PEDRO_ID}


def test_specialist_without_patients_gets_empty_list(client, other_specialist_headers):
    assert client.get("/api/patients/", headers=other_specialist_headers).json() == []


def test_admin_lists_all_patients(client, admin_headers):
    ids = {p["id"] for p in client.get("/api/patients/", headers=admin_headers).json()}
    assert {seed_data.PATIENT_PEDRO_ID, seed_data.PATIENT_ANA_ID} <= ids


def test_patient_cannot_list_patients(client, patient_headers):
    assert client.get("/api/patients/", headers=patient_headers).status_code == 403


def test_list_marks_new_patient_without_alert(client, admin_headers):
    ana = next(p for p in client.get("/api/patients/", headers=admin_headers).json() if p["id"] == seed_data.PATIENT_ANA_ID)
    assert ana["isNew"] is True
    assert ana["hasAlert"] is False


def test_list_search_and_pagination(client, admin_headers):
    r = client.get("/api/patients/?search=ana", headers=admin_headers)
    assert [p["id"] for p in r.json()] == [seed_data.PATIENT_ANA_ID]
    assert len(client.get("/api/patients/?limit=1", headers=admin_headers).json()) == 1


def test_specialist_lookup_by_rut_unassigned_has_no_history(client, specialist_headers):
    r = client.get(f"/api/patients/by-rut/{seed_data.PATIENT_ANA_RUT}", headers=specialist_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["rut"] == seed_data.PATIENT_ANA_RUT
    assert data["assignedToMe"] is False
    assert data["sessions"] is None


def test_specialist_lookup_by_rut_assigned_has_history(client, specialist_headers):
    data = client.get("/api/patients/by-rut/98.765.432-5", headers=specialist_headers).json()
    assert data["assignedToMe"] is True
    assert data["metrics"]["sessionsTotal"] >= 1


def test_lookup_by_rut_not_found_404(client, specialist_headers):
    assert client.get("/api/patients/by-rut/00000000-0", headers=specialist_headers).status_code == 404


def test_get_patient_by_id_access(
    client, specialist_headers, other_specialist_headers, patient_headers, ana_headers, admin_headers
):
    url = f"/api/patients/{seed_data.PATIENT_PEDRO_ID}"
    assert client.get(url, headers=specialist_headers).status_code == 200
    assert client.get(url, headers=other_specialist_headers).status_code == 403
    assert client.get(url, headers=patient_headers).status_code == 200
    assert client.get(url, headers=ana_headers).status_code == 403
    assert client.get(url, headers=admin_headers).status_code == 200
    assert client.get("/api/patients/no-es-uuid", headers=admin_headers).status_code == 404


def test_assign_and_unassign(client, other_specialist_headers):
    r = client.post("/api/patients/assign", json={"rut": "11.111.111-1"}, headers=other_specialist_headers)
    assert r.status_code == 200, r.text
    assert (
        client.post("/api/patients/assign", json={"rut": seed_data.PATIENT_ANA_RUT}, headers=other_specialist_headers).status_code
        == 409
    )
    assert [p["id"] for p in client.get("/api/patients/", headers=other_specialist_headers).json()] == [seed_data.PATIENT_ANA_ID]

    r = client.delete(f"/api/patients/{seed_data.PATIENT_ANA_ID}/assign", headers=other_specialist_headers)
    assert r.status_code == 204
    assert client.get("/api/patients/", headers=other_specialist_headers).json() == []
    assert client.delete(f"/api/patients/{seed_data.PATIENT_ANA_ID}/assign", headers=other_specialist_headers).status_code == 404


def test_assign_unknown_rut_404(client, specialist_headers):
    assert client.post("/api/patients/assign", json={"rut": "1-9"}, headers=specialist_headers).status_code == 404


def test_disable_patient_blocks_login(client, specialist_headers, patient_headers):
    url = f"/api/patients/{seed_data.PATIENT_PEDRO_ID}/status"
    r = client.patch(url, json={"active": False}, headers=specialist_headers)
    assert r.status_code == 200, r.text
    assert r.json()["active"] is False

    r = client.post("/api/auth/login", json={"email": seed_data.PATIENT_EMAIL, "password": seed_data.PATIENT_PASSWORD})
    assert r.status_code == 403
    assert client.get("/api/me", headers=patient_headers).status_code == 403

    r = client.patch(url, json={"active": True}, headers=specialist_headers)
    assert r.json()["active"] is True
    assert client.get("/api/me", headers=patient_headers).status_code == 200


def test_disable_patient_requires_assignment(client, other_specialist_headers, patient_headers):
    url = f"/api/patients/{seed_data.PATIENT_PEDRO_ID}/status"
    assert client.patch(url, json={"active": False}, headers=other_specialist_headers).status_code == 403
    assert client.patch(url, json={"active": False}, headers=patient_headers).status_code == 403


def test_my_sessions_history(client, patient_headers, ana_headers):
    r = client.get("/api/patients/me/sessions", headers=patient_headers)
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) >= 1
    first = items[0]
    assert first["name"] == "Rutina de prueba - sesiones"
    assert first["date"].endswith("+00:00") or "T" in first["date"]  # ISO
    assert first["exercises_total"] == 1

    assert client.get("/api/patients/me/sessions", headers=ana_headers).json() == []
