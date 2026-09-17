"""Sesiones + encuestas: flujo completo, propiedad (EP-02), complete idempotente
(EP-08), seid ∈ sid, encuestas 1-5 idempotentes (R-02)."""

from tests import seed_data


def _start(client, headers, routine_id=seed_data.ROUTINE_ID, **extra):
    r = client.post("/api/sessions", json={"routine_id": routine_id, **extra}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_full_session_and_survey_flow(client, patient_headers):
    session = _start(client, patient_headers)
    assert session["patient_id"] == seed_data.PATIENT_PEDRO_ID
    assert session["is_completed"] is False
    ses = session["session_exercises"]
    assert [se["exercise_id"] for se in ses] == ["toe_touch", "leg_raise", "shoulder_raises", "squat"]
    session_id = session["id"]

    r = client.post(
        "/api/surveys/pre",
        json={"session_id": session_id, "pain_level": 2, "fatigue_level": 3, "stress_level": 1},
        headers=patient_headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["type"] == "PRE_SESSION"

    r = client.put(
        f"/api/sessions/{session_id}/exercises/{ses[0]['id']}",
        json={"series_completed": 1, "reps_completed": 10, "accuracy_score": 90.5, "feedback": "Baja más"},
        headers=patient_headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["reps_completed"] == 10
    assert r.json()["accuracy_score"] == 90.5

    r = client.post(f"/api/sessions/{session_id}/complete", headers=patient_headers)
    assert r.status_code == 200, r.text
    assert r.json()["is_completed"] is True
    assert r.json()["completed_at"] is not None
    assert r.json()["duration_minutes"] == 0
    assert len(r.json()["session_exercises"]) == 4

    r = client.post(
        "/api/surveys/post",
        json={"session_id": session_id, "mood_level": 4, "pain_level": 1, "comments": "listo"},
        headers=patient_headers,
    )
    assert r.status_code == 201, r.text
    assert r.json()["mood_level"] == 4

    data = client.get(f"/api/sessions/{session_id}", headers=patient_headers).json()
    assert data["is_completed"] is True
    assert data["session_exercises"][0]["reps_completed"] == 10

    history = client.get("/api/patients/me/sessions", headers=patient_headers).json()
    mine = next(s for s in history if s["id"] == session_id)
    assert mine["pre_survey"]["pain_level"] == 2
    assert mine["post_survey"]["mood_level"] == 4
    assert mine["exercises_done"] == 1
    assert mine["exercises_total"] == 4


def test_complete_is_idempotent(client, patient_headers):
    session_id = _start(client, patient_headers)["id"]
    first = client.post(f"/api/sessions/{session_id}/complete", headers=patient_headers).json()
    second = client.post(f"/api/sessions/{session_id}/complete", headers=patient_headers).json()
    assert first["completed_at"] == second["completed_at"]
    assert first["duration_minutes"] == second["duration_minutes"]


def test_patient_body_patient_id_is_ignored(client, patient_headers):
    session = _start(client, patient_headers, patient_id=seed_data.PATIENT_ANA_ID)
    assert session["patient_id"] == seed_data.PATIENT_PEDRO_ID


def test_routine_must_belong_to_patient(client, ana_headers):
    r = client.post("/api/sessions", json={"routine_id": seed_data.ROUTINE_ID}, headers=ana_headers)
    assert r.status_code == 403


def test_unknown_routine_404(client, patient_headers):
    r = client.post("/api/sessions", json={"routine_id": "00000000-0000-0000-0000-000000000000"}, headers=patient_headers)
    assert r.status_code == 404


def test_specialist_can_start_session_for_assigned_patient_only(client, specialist_headers, other_specialist_headers):
    r = client.post("/api/sessions", json={"routine_id": seed_data.ROUTINE_ID}, headers=specialist_headers)
    assert r.status_code == 422  # falta patient_id
    session = _start(client, specialist_headers, patient_id=seed_data.PATIENT_PEDRO_ID)
    assert session["patient_id"] == seed_data.PATIENT_PEDRO_ID
    r = client.post(
        "/api/sessions",
        json={"routine_id": seed_data.ROUTINE_ID, "patient_id": seed_data.PATIENT_PEDRO_ID},
        headers=other_specialist_headers,
    )
    assert r.status_code == 403


def test_other_patient_cannot_touch_session(client, patient_headers, ana_headers):
    session = _start(client, patient_headers)
    sid, seid = session["id"], session["session_exercises"][0]["id"]
    assert client.get(f"/api/sessions/{sid}", headers=ana_headers).status_code == 403
    assert client.post(f"/api/sessions/{sid}/complete", headers=ana_headers).status_code == 403
    assert (
        client.put(
            f"/api/sessions/{sid}/exercises/{seid}", json={"series_completed": 1, "reps_completed": 1}, headers=ana_headers
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/surveys/pre", json={"session_id": sid, "pain_level": 1, "fatigue_level": 1}, headers=ana_headers
        ).status_code
        == 403
    )
    assert client.post("/api/surveys/post", json={"session_id": sid, "mood_level": 1}, headers=ana_headers).status_code == 403


def test_session_exercise_must_belong_to_session(client, patient_headers):
    a = _start(client, patient_headers)
    b = _start(client, patient_headers)
    r = client.put(
        f"/api/sessions/{a['id']}/exercises/{b['session_exercises'][0]['id']}",
        json={"series_completed": 1, "reps_completed": 1},
        headers=patient_headers,
    )
    assert r.status_code == 404


def test_session_not_found_404(client, patient_headers):
    assert client.get("/api/sessions/00000000-0000-0000-0000-000000000000", headers=patient_headers).status_code == 404


def test_progress_validation_422(client, patient_headers):
    s = _start(client, patient_headers)
    r = client.put(
        f"/api/sessions/{s['id']}/exercises/{s['session_exercises'][0]['id']}",
        json={"series_completed": -1, "reps_completed": 1},
        headers=patient_headers,
    )
    assert r.status_code == 422


def test_surveys_scale_and_idempotency(client, patient_headers):
    sid = _start(client, patient_headers)["id"]
    r = client.post("/api/surveys/pre", json={"session_id": sid, "pain_level": 6, "fatigue_level": 4}, headers=patient_headers)
    assert r.status_code == 422
    r = client.post("/api/surveys/pre", json={"session_id": sid, "pain_level": 3, "fatigue_level": 4}, headers=patient_headers)
    first_id = r.json()["id"]
    r = client.post("/api/surveys/pre", json={"session_id": sid, "pain_level": 5, "fatigue_level": 4}, headers=patient_headers)
    assert r.status_code == 201
    assert r.json()["id"] == first_id
    assert r.json()["pain_level"] == 5


def test_specialist_cannot_answer_surveys(client, specialist_headers):
    r = client.post(
        "/api/surveys/pre",
        json={"session_id": seed_data.SESSION_ID, "pain_level": 1, "fatigue_level": 1},
        headers=specialist_headers,
    )
    assert r.status_code == 403


def test_old_surveys_prefix_is_gone(client, patient_headers):
    r = client.post(
        "/surveys/pre", json={"session_id": seed_data.SESSION_ID, "pain_level": 1, "fatigue_level": 1}, headers=patient_headers
    )
    assert r.status_code == 404
