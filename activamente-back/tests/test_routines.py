"""Rutinas (TS-02): crear con validaciones (varios días), listar, active/next,
editar y borrar con dueño, y que las sesiones sobrevivan (routine_id → NULL)."""

from datetime import date, timedelta

from tests import seed_data

TODAY = date.today()


def _body(**overrides):
    body = {
        "patient_id": seed_data.PATIENT_PEDRO_ID,
        "name": "Rutina nueva",
        "start_date": TODAY.isoformat(),
        "end_date": (TODAY + timedelta(days=30)).isoformat(),
        "days_of_week": [TODAY.isoweekday()],
        "scheduled_time": "09:00:00",
        "exercises": [
            {"exercise_id": "squat", "order_index": 0, "level": 2, "total_series": 2, "total_reps": 8, "rest_time_seconds": 30},
            {"exercise_id": "toe_touch", "order_index": 1, "level": 1, "total_series": 1, "total_reps": 10},
        ],
    }
    body.update(overrides)
    return body


def test_create_routine_ok(client, specialist_headers):
    r = client.post("/api/routines", json=_body(), headers=specialist_headers)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["specialist_id"] == seed_data.SPECIALIST_ID
    assert [e["exercise_id"] for e in data["exercises"]] == ["squat", "toe_touch"]
    assert data["exercises"][0]["level"] == 2

    r = client.get(f"/api/routines/{data['id']}", headers=specialist_headers)
    assert r.status_code == 200
    assert len(r.json()["exercises"]) == 2


def test_create_routine_unassigned_patient_403(client, other_specialist_headers):
    assert client.post("/api/routines", json=_body(), headers=other_specialist_headers).status_code == 403


def test_create_routine_patient_403(client, patient_headers):
    assert client.post("/api/routines", json=_body(), headers=patient_headers).status_code == 403


def test_create_routine_validations_422(client, specialist_headers):
    assert client.post("/api/routines", json=_body(days_of_week=[8]), headers=specialist_headers).status_code == 422
    assert (
        client.post(
            "/api/routines", json=_body(end_date=(TODAY - timedelta(days=1)).isoformat()), headers=specialist_headers
        ).status_code
        == 422
    )
    assert client.post("/api/routines", json=_body(days_of_week=[]), headers=specialist_headers).status_code == 422
    assert client.post("/api/routines", json=_body(days_of_week=[1, 1]), headers=specialist_headers).status_code == 422
    assert client.post("/api/routines", json=_body(exercises=[]), headers=specialist_headers).status_code == 422

    r = client.post(
        "/api/routines", json=_body(exercises=[{"exercise_id": "no_existe", "order_index": 0}]), headers=specialist_headers
    )
    assert r.status_code == 422
    assert "no_existe" in r.json()["detail"]

    r = client.post(
        "/api/routines",
        json=_body(exercises=[{"exercise_id": "squat", "order_index": 0, "level": 4}]),
        headers=specialist_headers,
    )
    assert r.status_code == 422

    dup = [{"exercise_id": "squat", "order_index": 0}, {"exercise_id": "toe_touch", "order_index": 0}]
    assert client.post("/api/routines", json=_body(exercises=dup), headers=specialist_headers).status_code == 422


def test_list_routines_by_patient(client, specialist_headers, other_specialist_headers, patient_headers):
    url = f"/api/routines?patient_id={seed_data.PATIENT_PEDRO_ID}"
    r = client.get(url, headers=specialist_headers)
    assert r.status_code == 200
    assert seed_data.ROUTINE_ID in {x["id"] for x in r.json()}
    assert client.get(url, headers=other_specialist_headers).status_code == 403
    assert client.get(url, headers=patient_headers).status_code == 200


def test_active_routine_today(client, patient_headers, ana_headers):
    r = client.get(f"/api/routines/active?patient_id={seed_data.PATIENT_PEDRO_ID}", headers=patient_headers)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == seed_data.ROUTINE_ID
    assert client.get(f"/api/routines/active?patient_id={seed_data.PATIENT_ANA_ID}", headers=ana_headers).status_code == 404
    # Ana no puede mirar la rutina de Pedro.
    assert client.get(f"/api/routines/active?patient_id={seed_data.PATIENT_PEDRO_ID}", headers=ana_headers).status_code == 403


def test_next_routine(client, specialist_headers, patient_headers, ana_headers):
    r = client.get(f"/api/routines/next?patient_id={seed_data.PATIENT_PEDRO_ID}", headers=patient_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["is_today"] is True
    assert data["days_until"] == 0
    assert data["routine"]["id"] == seed_data.ROUTINE_ID

    # Rutina de Ana que empieza en 3 días, para el weekday de ese día.
    start = TODAY + timedelta(days=3)
    client.post("/api/patients/assign", json={"rut": seed_data.PATIENT_ANA_RUT}, headers=specialist_headers)
    r = client.post(
        "/api/routines",
        json=_body(
            patient_id=seed_data.PATIENT_ANA_ID,
            start_date=start.isoformat(),
            end_date=(start + timedelta(days=14)).isoformat(),
            days_of_week=[start.isoweekday()],
        ),
        headers=specialist_headers,
    )
    assert r.status_code == 201, r.text
    data = client.get(f"/api/routines/next?patient_id={seed_data.PATIENT_ANA_ID}", headers=ana_headers).json()
    assert data["is_today"] is False
    assert data["days_until"] == 3
    assert data["next_date"] == start.isoformat()


def test_next_routine_none(client, ana_headers):
    data = client.get(f"/api/routines/next?patient_id={seed_data.PATIENT_ANA_ID}", headers=ana_headers).json()
    assert data == {"routine": None, "next_date": None, "is_today": False, "days_until": None}


def test_delete_routine_owner_only_and_keeps_sessions(client, specialist_headers, other_specialist_headers, patient_headers):
    r = client.post("/api/routines", json=_body(), headers=specialist_headers)
    routine_id = r.json()["id"]
    # Una sesión sobre esa rutina.
    r = client.post("/api/sessions", json={"routine_id": routine_id}, headers=patient_headers)
    assert r.status_code == 201, r.text
    session_id = r.json()["id"]

    assert client.delete(f"/api/routines/{routine_id}", headers=other_specialist_headers).status_code == 403
    assert client.delete(f"/api/routines/{routine_id}", headers=patient_headers).status_code == 403
    assert client.delete(f"/api/routines/{routine_id}", headers=specialist_headers).status_code == 204
    assert client.delete(f"/api/routines/{routine_id}", headers=specialist_headers).status_code == 404

    r = client.get(f"/api/sessions/{session_id}", headers=patient_headers)
    assert r.status_code == 200
    assert r.json()["routine_id"] is None
    assert all(se["routine_exercise_id"] is None for se in r.json()["session_exercises"])


def test_admin_can_delete_any_routine(client, admin_headers, specialist_headers):
    routine_id = client.post("/api/routines", json=_body(), headers=specialist_headers).json()["id"]
    assert client.delete(f"/api/routines/{routine_id}", headers=admin_headers).status_code == 204


def test_create_routine_several_days_sorted(client, specialist_headers):
    r = client.post("/api/routines", json=_body(days_of_week=[5, 1, 3]), headers=specialist_headers)
    assert r.status_code == 201, r.text
    assert r.json()["days_of_week"] == [1, 3, 5]


def test_active_and_next_with_several_days(client, specialist_headers, ana_headers):
    client.post("/api/patients/assign", json={"rut": seed_data.PATIENT_ANA_RUT}, headers=specialist_headers)
    in_two = (TODAY + timedelta(days=2)).isoweekday()
    in_four = (TODAY + timedelta(days=4)).isoweekday()
    body = _body(patient_id=seed_data.PATIENT_ANA_ID, days_of_week=[in_four, in_two])
    assert client.post("/api/routines", json=body, headers=specialist_headers).status_code == 201

    url = f"/api/routines/active?patient_id={seed_data.PATIENT_ANA_ID}"
    assert client.get(url, headers=ana_headers).status_code == 404
    data = client.get(f"/api/routines/next?patient_id={seed_data.PATIENT_ANA_ID}", headers=ana_headers).json()
    assert data["days_until"] == 2


def test_update_routine_syncs_exercises_in_place(client, specialist_headers, patient_headers):
    created = client.post("/api/routines", json=_body(), headers=specialist_headers).json()
    squat_id = next(e["id"] for e in created["exercises"] if e["exercise_id"] == "squat")
    session_id = client.post("/api/sessions", json={"routine_id": created["id"]}, headers=patient_headers).json()["id"]

    update = _body(
        name="  Rutina editada ",
        days_of_week=[2, 6],
        scheduled_time=None,
        exercises=[
            {"exercise_id": "leg_raise", "order_index": 0, "level": 1, "total_series": 1, "total_reps": 5},
            {"exercise_id": "squat", "order_index": 1, "level": 3, "total_series": 4, "total_reps": 12},
        ],
    )
    del update["patient_id"]
    r = client.put(f"/api/routines/{created['id']}", json=update, headers=specialist_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == "Rutina editada"
    assert data["days_of_week"] == [2, 6]
    assert data["scheduled_time"] is None
    assert [e["exercise_id"] for e in data["exercises"]] == ["leg_raise", "squat"]
    squat = data["exercises"][1]
    # squat se actualizó en su lugar: mismo id, nuevos valores.
    assert squat["id"] == squat_id
    assert (squat["level"], squat["total_series"], squat["total_reps"]) == (3, 4, 12)

    # La sesión existente sigue viva; el ejercicio quitado (toe_touch) queda desvinculado.
    ses = client.get(f"/api/sessions/{session_id}", headers=patient_headers).json()
    links = {se["exercise_id"]: se["routine_exercise_id"] for se in ses["session_exercises"]}
    assert links["squat"] == squat_id
    assert links["toe_touch"] is None


def test_update_routine_permissions_and_validation(client, specialist_headers, other_specialist_headers, patient_headers):
    routine_id = client.post("/api/routines", json=_body(), headers=specialist_headers).json()["id"]
    update = _body()
    del update["patient_id"]
    url = f"/api/routines/{routine_id}"
    assert client.put(url, json=update, headers=other_specialist_headers).status_code == 403
    assert client.put(url, json=update, headers=patient_headers).status_code == 403
    assert client.put(url, json={**update, "days_of_week": [0]}, headers=specialist_headers).status_code == 422
    dup = [{"exercise_id": "squat", "order_index": 0}, {"exercise_id": "squat", "order_index": 1}]
    assert client.put(url, json={**update, "exercises": dup}, headers=specialist_headers).status_code == 422
    missing = "/api/routines/00000000-0000-0000-0000-000000000000"
    assert client.put(missing, json=update, headers=specialist_headers).status_code == 404
