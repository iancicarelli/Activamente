"""Privacidad (Ley 21.719): términos obligatorios, solicitudes de eliminación y registro de accesos."""

from uuid import UUID

from sqlalchemy import text

from app.core.terms import TERMS_VERSION
from app.models.access_log_model import AccessLog
from tests import seed_data
from tests.conftest import bearer
from tests.helpers import accept_terms, auth, create_user, real_login

PEDRO = seed_data.PATIENT_PEDRO_ID


def _new_patient(client, admin_headers, email="nuevo@test.com", rut="15.123.456-9") -> tuple[dict, dict]:
    u = create_user(client, admin_headers, role="paciente", full_name="Nuevo Paciente", email=email, rut=rut)
    return u, auth(real_login(client, email=email, password=u["temp_password"]))


# ── Términos ──────────────────────────────────────────────────────────────────


def test_seed_users_already_accepted(client, patient_headers):
    r = client.get("/api/me/terms", headers=patient_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["version"] == TERMS_VERSION and data["accepted"] is True and data["accepted_at"]
    assert any(s["title"] == "Uso de la cámara" for s in data["sections"])


def test_new_user_is_blocked_until_accepting(client, admin_headers):
    _, h = _new_patient(client, admin_headers)
    for path in ("/api/me", "/api/routines/active", "/api/patients/me/sessions"):
        r = client.get(path, headers=h)
        assert r.status_code == 403, path
        assert r.headers["X-Terms-Required"] == "1"

    terms = client.get("/api/me/terms", headers=h).json()
    assert terms["accepted"] is False and terms["accepted_at"] is None

    assert client.post("/api/me/terms", json={"version": "1999-01-01"}, headers=h).status_code == 409
    accept_terms(client, h)
    accept_terms(client, h)  # idempotente
    assert client.get("/api/me", headers=h).status_code == 200
    assert client.get("/api/me/terms", headers=h).json()["accepted"] is True


def test_password_change_works_before_accepting(client, admin_headers):
    u, h = _new_patient(client, admin_headers)
    r = client.post(
        "/api/auth/change-password", json={"current_password": u["temp_password"], "new_password": "ClaveNueva123"}, headers=h
    )
    assert r.status_code == 204, r.text


def test_terms_text_depends_on_role(client, patient_headers, specialist_headers):
    patient = {s["title"] for s in client.get("/api/me/terms", headers=patient_headers).json()["sections"]}
    staff = {s["title"] for s in client.get("/api/me/terms", headers=specialist_headers).json()["sections"]}
    assert "Participación voluntaria" in patient - staff
    assert "Confidencialidad del equipo" in staff - patient


# ── Solicitudes de eliminación ───────────────────────────────────────────────


def test_patient_requests_deletion_once(client, patient_headers):
    assert client.get("/api/me/deletion-request", headers=patient_headers).json() is None
    r = client.post("/api/me/deletion-request", json={"reason": "Ya no participo"}, headers=patient_headers)
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "PENDING"
    assert client.post("/api/me/deletion-request", json={}, headers=patient_headers).status_code == 409
    assert client.get("/api/me/deletion-request", headers=patient_headers).json()["status"] == "PENDING"


def test_only_patients_request_and_only_admins_resolve(client, patient_headers, specialist_headers, admin_headers):
    assert client.post("/api/me/deletion-request", json={}, headers=specialist_headers).status_code == 403
    assert client.post("/api/me/deletion-request", json={}, headers=admin_headers).status_code == 403
    rid = client.post("/api/me/deletion-request", json={}, headers=patient_headers).json()["id"]
    for path in ("/api/admins/deletion-requests", "/api/admins/access-log"):
        assert client.get(path, headers=specialist_headers).status_code == 403
    for action in ("approve", "reject"):
        r = client.post(f"/api/admins/deletion-requests/{rid}/{action}", headers=specialist_headers)
        assert r.status_code == 403


def test_reject_keeps_everything_and_allows_a_new_request(client, patient_headers, admin_headers):
    rid = client.post("/api/me/deletion-request", json={}, headers=patient_headers).json()["id"]
    pending = client.get("/api/admins/deletion-requests?status=PENDING", headers=admin_headers).json()
    item = next(p for p in pending if p["id"] == rid)
    assert item["rut"] == seed_data.PATIENT_PEDRO_RUT and item["email"] == seed_data.PATIENT_EMAIL

    r = client.post(f"/api/admins/deletion-requests/{rid}/reject", headers=admin_headers)
    assert r.status_code == 200 and r.json()["status"] == "REJECTED"
    assert client.post(f"/api/admins/deletion-requests/{rid}/approve", headers=admin_headers).status_code == 409
    assert client.get("/api/me", headers=patient_headers).status_code == 200
    assert client.post("/api/me/deletion-request", json={}, headers=patient_headers).status_code == 201


def _count(db, sql: str) -> int:
    return db.execute(text(sql), {"p": PEDRO}).scalar()


def test_approve_deletes_the_patient_and_all_their_data(client, db, patient_headers, admin_headers, specialist_headers):
    # Pedro tiene rutina, sesión y asignación en el seed; se le agrega una cita y una encuesta.
    db.execute(
        text(
            "INSERT INTO appointments (specialist_id, patient_id, date, time_slot, notes) "
            "VALUES (:s, :p, CURRENT_DATE, '10:00', 'nota con datos')"
        ),
        {"s": seed_data.SPECIALIST_ID, "p": PEDRO},
    )
    db.execute(
        text("INSERT INTO surveys (session_id, type, pain_level) VALUES (:sid, 'PRE_SESSION', 3)"), {"sid": seed_data.SESSION_ID}
    )
    client.get(f"/api/patients/{PEDRO}", headers=specialist_headers)  # deja una fila en access_log
    before = {
        t: _count(db, f"SELECT count(*) FROM {t}")
        for t in ("routines", "sessions", "appointments", "surveys", "specialist_patient", "terms_acceptances")
    }

    rid = client.post("/api/me/deletion-request", json={"reason": "Motivo personal"}, headers=patient_headers).json()["id"]
    r = client.post(f"/api/admins/deletion-requests/{rid}/approve", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "APPROVED"

    assert _count(db, "SELECT count(*) FROM users WHERE id = :p") == 0
    for table, where in (
        ("patients", "user_id = :p"),
        ("specialist_patient", "patient_id = :p"),
        ("routines", "patient_id = :p"),
        ("sessions", "patient_id = :p"),
        ("appointments", "patient_id = :p"),
        ("terms_acceptances", "user_id = :p"),
    ):
        assert _count(db, f"SELECT count(*) FROM {table} WHERE {where}") == 0, table
    assert _count(db, "SELECT count(*) FROM surveys") < before["surveys"]
    assert _count(db, "SELECT count(*) FROM session_exercises WHERE session_id NOT IN (SELECT id FROM sessions)") == 0
    # Ni la cita quedó huérfana con sus notas (SET NULL), ni el motivo de la solicitud sobrevive.
    assert _count(db, "SELECT count(*) FROM appointments WHERE patient_id IS NULL AND notes = 'nota con datos'") == 0
    assert _count(db, f"SELECT count(*) FROM deletion_requests WHERE id = '{rid}' AND reason IS NULL") == 1
    # El registro de accesos se conserva (solo ids) y el resto de pacientes no se tocó.
    assert db.query(AccessLog).filter(AccessLog.patient_id == UUID(PEDRO)).count() >= 1
    assert _count(db, f"SELECT count(*) FROM users WHERE id = '{seed_data.PATIENT_ANA_ID}'") == 1

    assert (
        client.post(
            "/api/auth/login", json={"email": seed_data.PATIENT_EMAIL, "password": seed_data.PATIENT_PASSWORD}
        ).status_code
        == 401
    )
    assert client.get("/api/me", headers=patient_headers).status_code == 401
    listed = client.get("/api/admins/deletion-requests", headers=admin_headers).json()
    done = next(x for x in listed if x["id"] == rid)
    assert done["full_name"] is None and done["reason"] is None and done["resolved_at"]


# ── Registro de accesos ──────────────────────────────────────────────────────


def _log(client, admin_headers, **params) -> list[dict]:
    r = client.get("/api/admins/access-log", params=params, headers=admin_headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_specialist_access_is_logged(client, specialist_headers, admin_headers):
    assert client.get(f"/api/patients/{PEDRO}", headers=specialist_headers).status_code == 200
    rows = _log(client, admin_headers, patient_id=PEDRO, actor_id=seed_data.SPECIALIST_ID)
    assert rows and rows[0]["allowed"] is True
    assert rows[0]["method"] == "GET" and rows[0]["path"] == f"/api/patients/{PEDRO}"
    assert rows[0]["actor_role"] == "SPECIALIST" and rows[0]["actor_name"] == "María González"


def test_denied_attempt_is_logged_even_though_the_request_fails(client, other_specialist_headers, admin_headers):
    assert client.get(f"/api/patients/{PEDRO}", headers=other_specialist_headers).status_code == 403
    rows = _log(client, admin_headers, patient_id=PEDRO, denied_only=True)
    assert rows and rows[0]["actor_id"] == seed_data.SPECIALIST2_ID and rows[0]["allowed"] is False


def test_patients_looking_at_themselves_are_not_logged(client, patient_headers, admin_headers):
    before = len(_log(client, admin_headers, patient_id=PEDRO, limit=500))
    assert client.get(f"/api/routines/active?patient_id={PEDRO}", headers=patient_headers).status_code == 200
    # El admin sí queda registrado al consultar, pero la consulta al log no pasa por authz.
    assert len(_log(client, admin_headers, patient_id=PEDRO, limit=500)) == before


def test_admin_access_is_logged_too(client, admin_headers):
    client.get(f"/api/patients/{PEDRO}", headers=admin_headers)
    rows = _log(client, admin_headers, actor_id=seed_data.ADMIN_ID)
    assert rows and rows[0]["actor_role"] == "ADMIN" and rows[0]["patient_id"] == PEDRO


def test_access_log_survives_the_actor(client, db, admin_headers):
    # Un especialista borrado deja sus filas, sin nombre.
    client.get(f"/api/patients/{PEDRO}", headers=bearer(seed_data.SPECIALIST_ID, "SPECIALIST"))
    db.execute(text("DELETE FROM users WHERE id = :s"), {"s": seed_data.SPECIALIST_ID})
    rows = _log(client, admin_headers, actor_id=seed_data.SPECIALIST_ID)
    assert rows and rows[0]["actor_name"] is None
