"""E2E: rutina de principio a fin desde el especialista: crear → el paciente la
ve → editar en caliente (los ejercicios conservan id, una sesión abierta no se
rompe) → desasignar paciente → borrar rutina (las sesiones quedan)."""

from tests import seed_data
from tests.helpers import routine_body


def test_routine_lifecycle(client, specialist_headers, patient_headers, other_specialist_headers):
    pedro = seed_data.PATIENT_PEDRO_ID
    r = client.post("/api/routines", json=routine_body(pedro, name="Rutina ciclo"), headers=specialist_headers)
    assert r.status_code == 201, r.text
    routine = r.json()
    squat_id = next(e["id"] for e in routine["exercises"] if e["exercise_id"] == "squat")

    # Otro especialista no la ve ni la edita.
    assert client.get(f"/api/routines/{routine['id']}", headers=other_specialist_headers).status_code == 403

    # El paciente abre una sesión sobre ella.
    s = client.post("/api/sessions", json={"routine_id": routine["id"]}, headers=patient_headers).json()
    se_squat = next(e for e in s["session_exercises"] if e["exercise_id"] == "squat")
    assert se_squat["routine_exercise_id"] == squat_id

    # Edición: sube nivel de squat, quita shoulder_raises, agrega toe_touch.
    body = {k: v for k, v in routine_body(pedro, name="Rutina ciclo v2").items() if k != "patient_id"}
    body["exercises"] = [
        {"exercise_id": "squat", "order_index": 0, "level": 2, "total_series": 2, "total_reps": 8},
        {"exercise_id": "toe_touch", "order_index": 1, "level": 1},
    ]
    r = client.put(f"/api/routines/{routine['id']}", json=body, headers=specialist_headers)
    assert r.status_code == 200, r.text
    updated = r.json()
    assert updated["name"] == "Rutina ciclo v2"
    assert [e["exercise_id"] for e in updated["exercises"]] == ["squat", "toe_touch"]
    assert next(e["id"] for e in updated["exercises"] if e["exercise_id"] == "squat") == squat_id  # conserva id
    assert next(e["level"] for e in updated["exercises"] if e["exercise_id"] == "squat") == 2

    # Nivel por sobre max_level del ejercicio → 422 (toe_touch tiene 2).
    body["exercises"][1]["level"] = 3
    assert client.put(f"/api/routines/{routine['id']}", json=body, headers=specialist_headers).status_code == 422

    # La sesión abierta sigue leyéndose y su ejercicio de squat sigue apuntando al mismo routine_exercise.
    s2 = client.get(f"/api/sessions/{s['id']}", headers=patient_headers).json()
    assert next(e for e in s2["session_exercises"] if e["exercise_id"] == "squat")["routine_exercise_id"] == squat_id

    # El paciente la ve entre sus rutinas.
    ids = [x["id"] for x in client.get(f"/api/routines?patient_id={pedro}", headers=patient_headers).json()]
    assert routine["id"] in ids

    # Borrar: el paciente ya no la ve, la sesión sigue existiendo sin rutina.
    assert client.delete(f"/api/routines/{routine['id']}", headers=other_specialist_headers).status_code == 403
    assert client.delete(f"/api/routines/{routine['id']}", headers=specialist_headers).status_code == 204
    assert client.get(f"/api/routines/{routine['id']}", headers=patient_headers).status_code == 404
    s3 = client.get(f"/api/sessions/{s['id']}", headers=patient_headers).json()
    assert s3["routine_id"] is None

    # Desasignar: María deja de ver a Pedro; volver a asignar por RUT.
    assert client.delete(f"/api/patients/{pedro}/assign", headers=specialist_headers).status_code == 204
    assert client.get(f"/api/patients/{pedro}", headers=specialist_headers).status_code == 403
    assert (
        client.post("/api/patients/assign", json={"rut": seed_data.PATIENT_PEDRO_RUT}, headers=specialist_headers).status_code
        == 200
    )
    assert client.get(f"/api/patients/{pedro}", headers=specialist_headers).status_code == 200
