"""E2E: el recorrido completo de negocio, de punta a punta y con login REAL
(bcrypt), tal como lo hace la app:

  admin crea especialista y paciente → especialista entra con la clave temporal,
  la cambia, asigna al paciente por RUT y le arma una rutina para hoy →
  el paciente entra por RUT, ve su rutina de hoy, abre sesión, responde la
  encuesta previa, registra cada ejercicio, completa (idempotente), responde la
  encuesta final con dolor alto → el especialista ve la sesión, la alerta de
  bienestar y el dashboard del día → agenda una cita, el paciente la ve, se
  cancela y desaparece.

Todo dentro de la transacción del test: no deja rastro en la base.
"""

from datetime import timedelta

from app.core.config import today_local
from tests.helpers import accept_terms, auth, create_user, real_login, routine_body


def test_full_patient_journey(client, admin_headers):
    # ── 1. Admin da de alta al especialista y al paciente ──────────────────
    spec = create_user(
        client,
        admin_headers,
        role="especialista",
        full_name="Laura Fuentes",
        email="laura.e2e@test.com",
        rut="16.456.789-3",
        specialty="Kinesiología",
    )
    pat = create_user(
        client, admin_headers, role="paciente", full_name="Rosa Muñoz", email="rosa.e2e@test.com", rut="6.123.456-K", age=71
    )
    assert spec["temp_password"] and pat["temp_password"]

    # ── 2. Especialista: clave temporal → cambio → perfil ──────────────────
    tok = real_login(client, email="laura.e2e@test.com", password=spec["temp_password"])
    assert tok["role"] == "SPECIALIST" and tok["expires_in"] == 3600
    r = client.post(
        "/api/auth/change-password",
        json={"current_password": spec["temp_password"], "new_password": "LauraNueva1!"},
        headers=auth(tok),
    )
    assert r.status_code == 204, r.text
    assert (
        client.post("/api/auth/login", json={"email": "laura.e2e@test.com", "password": spec["temp_password"]}).status_code == 401
    )
    spec_h = auth(real_login(client, email="laura.e2e@test.com", password="LauraNueva1!"))
    accept_terms(client, spec_h)
    assert client.get("/api/specialists/me", headers=spec_h).json()["specialty"] == "Kinesiología"

    # Sin pacientes todavía: dashboard vacío, lista vacía.
    dash = client.get("/api/specialists/dashboard", headers=spec_h).json()
    assert dash["stats"]["total_patients"] == 0
    assert client.get("/api/patients/", headers=spec_h).json() == []

    # ── 3. Asignación por RUT y rutina para hoy ────────────────────────────
    r = client.post("/api/patients/assign", json={"rut": "6123456-k"}, headers=spec_h)
    assert r.status_code == 200, r.text
    assert r.json()["patient_id"] == pat["id"]
    assert client.post("/api/patients/assign", json={"rut": "6123456-k"}, headers=spec_h).status_code == 409

    lst = client.get("/api/patients/", headers=spec_h).json()
    assert [p["id"] for p in lst] == [pat["id"]]
    assert lst[0]["isNew"] is True and lst[0]["hasAlert"] is False

    r = client.post("/api/routines", json=routine_body(pat["id"], name="Rutina Rosa"), headers=spec_h)
    assert r.status_code == 201, r.text
    routine = r.json()
    assert [e["exercise_id"] for e in routine["exercises"]] == ["squat", "shoulder_raises"]

    # ── 4. Paciente: entra por RUT con la clave temporal ───────────────────
    ptok = real_login(client, rut="6.123.456-K", password=pat["temp_password"])
    assert ptok["role"] == "PATIENT" and ptok["expires_in"] == 12 * 3600
    pat_h = auth(ptok)
    accept_terms(client, pat_h)
    me = client.get("/api/me", headers=pat_h).json()
    assert me["role"] == "PATIENT"
    assert [s["email"] for s in me["patient"]["specialists"]] == ["laura.e2e@test.com"]
    assert me["patient"]["rut"] == "6123456-K"

    active = client.get(f"/api/routines/active?patient_id={pat['id']}", headers=pat_h)
    assert active.status_code == 200, active.text
    assert active.json()["id"] == routine["id"]
    nxt = client.get(f"/api/routines/next?patient_id={pat['id']}", headers=pat_h).json()
    assert nxt["is_today"] is True and nxt["days_until"] == 0

    # ── 5. Sesión: crear → encuesta previa → ejercicios → completar ────────
    r = client.post("/api/sessions", json={"routine_id": routine["id"]}, headers=pat_h)
    assert r.status_code == 201, r.text
    session = r.json()
    assert session["patient_id"] == pat["id"] and session["is_completed"] is False
    assert [e["exercise_id"] for e in session["session_exercises"]] == ["squat", "shoulder_raises"]

    r = client.post(
        "/api/surveys/pre",
        json={"session_id": session["id"], "pain_level": 2, "fatigue_level": 3, "stress_level": 2},
        headers=pat_h,
    )
    assert r.status_code == 201, r.text

    for se, reps in zip(session["session_exercises"], (5, 4), strict=True):
        r = client.put(
            f"/api/sessions/{session['id']}/exercises/{se['id']}",
            json={"series_completed": 1, "reps_completed": reps, "accuracy_score": 88.5, "feedback": "ok"},
            headers=pat_h,
        )
        assert r.status_code == 200, r.text
        assert r.json()["reps_completed"] == reps

    done = client.post(f"/api/sessions/{session['id']}/complete", headers=pat_h).json()
    assert done["is_completed"] is True and done["completed_at"]
    again = client.post(f"/api/sessions/{session['id']}/complete", headers=pat_h).json()
    assert again["completed_at"] == done["completed_at"]  # idempotente

    r = client.post(
        "/api/surveys/post",
        json={"session_id": session["id"], "mood_level": 4, "pain_level": 5, "comments": "me dolió la rodilla"},
        headers=pat_h,
    )
    assert r.status_code == 201, r.text

    hist = client.get("/api/patients/me/sessions", headers=pat_h).json()
    assert len(hist) == 1
    assert hist[0]["completed"] is True and hist[0]["exercises_done"] == 2 and hist[0]["exercises_total"] == 2
    assert hist[0]["pre_survey"]["pain_level"] == 2 and hist[0]["post_survey"]["pain_level"] == 5

    # ── 6. Especialista ve la sesión, la alerta de bienestar y el dashboard ─
    got = client.get(f"/api/sessions/{session['id']}", headers=spec_h)
    assert got.status_code == 200 and got.json()["is_completed"] is True

    lst = client.get("/api/patients/", headers=spec_h).json()
    assert lst[0]["hasAlert"] is True and lst[0]["alertKind"] == "wellbeing" and lst[0]["isNew"] is False

    detail = client.get(f"/api/patients/{pat['id']}", headers=spec_h).json()
    assert detail["assignedToMe"] is True
    assert detail["metrics"]["sessionsCompleted"] == 1 and detail["metrics"]["sessionsCompletedThisWeek"] == 1
    assert detail["wellbeing"]["has_alert"] is True and detail["wellbeing"]["reasons"]
    assert detail["sessions"][0]["id"] == session["id"]

    dash = client.get("/api/specialists/dashboard", headers=spec_h).json()
    assert dash["stats"]["total_patients"] == 1 and dash["stats"]["alerts"] == 1
    assert dash["progress"]["sessions_completed_today"] == 1 and dash["progress"]["daily_compliance"] == 100

    # ── 7. Cita: agendar → el paciente la ve → cancelar → desaparece ───────
    tomorrow = (today_local() + timedelta(days=1)).isoformat()
    slots = client.get(f"/api/appointments/available-slots?date={tomorrow}", headers=spec_h).json()["slots"]
    free = next(s["time"] for s in slots if s["available"])
    r = client.post(
        "/api/appointments",
        json={"patient_id": pat["id"], "date": tomorrow, "time_slot": f"{free}:00", "notes": "control"},
        headers=spec_h,
    )
    assert r.status_code == 201, r.text
    appt = r.json()
    assert appt["patient_name"] == "Rosa Muñoz" and appt["specialist_name"] == "Laura Fuentes"

    nxt = client.get("/api/appointments/next", headers=pat_h).json()
    assert nxt and nxt["id"] == appt["id"]
    cal = client.get(f"/api/appointments/calendar?from={tomorrow}&to={tomorrow}", headers=spec_h).json()
    assert cal == [{"date": tomorrow, "count": 1}]

    r = client.patch(f"/api/appointments/{appt['id']}/status", json={"status": "CANCELLED"}, headers=spec_h)
    assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
    assert client.get("/api/appointments/next", headers=pat_h).json() is None
    slot_again = next(
        s
        for s in client.get(f"/api/appointments/available-slots?date={tomorrow}", headers=spec_h).json()["slots"]
        if s["time"] == free
    )
    assert slot_again["available"] is True  # cancelar libera el cupo
