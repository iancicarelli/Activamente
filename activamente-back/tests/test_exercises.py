"""Catálogo de ejercicios: slugs, instrucciones y max_level."""

from tests import seed_data


def test_list_exercises(client, patient_headers):
    r = client.get("/api/exercises", headers=patient_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert seed_data.EXERCISE_SLUGS <= {e["id"] for e in data}
    assert all(1 <= e["max_level"] <= 3 for e in data)


def test_exercises_include_instructions(client, patient_headers):
    toe = next(e for e in client.get("/api/exercises", headers=patient_headers).json() if e["id"] == "toe_touch")
    assert toe["instructions"]
    assert "Inclínate" in toe["instructions"]
    assert "Mantené" not in toe["instructions"]


def test_exercises_requires_auth(client):
    assert client.get("/api/exercises").status_code in (401, 403)
