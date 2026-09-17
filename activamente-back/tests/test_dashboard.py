"""Dashboard del especialista: sesiones de hoy por paciente (rutina programada
hoy vs. completadas por completed_at) y alertas de bienestar."""

from datetime import timedelta
from uuid import UUID

from app.core.config import now_utc
from app.models.session_model import Session as SessionModel
from app.models.survey_model import Survey, SurveyType
from tests import seed_data

URL = "/api/specialists/dashboard"
PEDRO = UUID(seed_data.PATIENT_PEDRO_ID)


def test_today_progress_counts_scheduled_and_completed(client, db, specialist_headers, patient_headers):
    progress = client.get(URL, headers=specialist_headers).json()["progress"]
    # Pedro tiene la rutina del seed todos los días y aún no completa nada hoy.
    assert progress == {"sessions_completed_today": 0, "sessions_total_today": 1, "daily_compliance": 0}

    sid = client.post("/api/sessions", json={"routine_id": seed_data.ROUTINE_ID}, headers=patient_headers).json()["id"]
    assert client.get(URL, headers=specialist_headers).json()["stats"]["active_today"] == 1
    assert client.post(f"/api/sessions/{sid}/complete", headers=patient_headers).status_code == 200

    progress = client.get(URL, headers=specialist_headers).json()["progress"]
    assert progress == {"sessions_completed_today": 1, "sessions_total_today": 1, "daily_compliance": 100}


def test_session_started_yesterday_completed_today_counts_today(client, db, specialist_headers):
    now = now_utc()
    db.add(
        SessionModel(
            patient_id=PEDRO, routine_id=seed_data.ROUTINE_ID, date=now - timedelta(days=1), is_completed=True, completed_at=now
        )
    )
    db.flush()
    progress = client.get(URL, headers=specialist_headers).json()["progress"]
    assert progress["sessions_completed_today"] == 1
    assert progress["daily_compliance"] == 100


def test_wellbeing_alert_counts_and_shows_in_list_and_record(client, db, specialist_headers):
    s = SessionModel(patient_id=PEDRO, routine_id=seed_data.ROUTINE_ID, date=now_utc())
    db.add(s)
    db.flush()
    db.add(Survey(session_id=s.id, type=SurveyType.PRE_SESSION, pain_level=5, fatigue_level=1))
    db.flush()

    assert client.get(URL, headers=specialist_headers).json()["stats"]["alerts"] == 1

    pedro = next(p for p in client.get("/api/patients/", headers=specialist_headers).json() if p["id"] == str(PEDRO))
    assert pedro["hasAlert"] is True
    assert pedro["alertKind"] == "wellbeing"
    assert pedro["alertMessage"] == "Dolor alto antes de la sesión"

    wellbeing = client.get(f"/api/patients/{PEDRO}", headers=specialist_headers).json()["wellbeing"]
    assert wellbeing["session_id"] == str(s.id)
    assert wellbeing["has_alert"] is True
    assert wellbeing["pre_survey"]["pain_level"] == 5
