"""Unit de app/services/patient_metrics.py (TS-06) con la DB de test:
alertas (nuevo / inactivo / bienestar de la última sesión con encuesta), adherencia,
esta semana y racha."""

from datetime import timedelta
from uuid import UUID

from app.core.config import now_utc
from app.models.session_model import Session as SessionModel
from app.models.survey_model import Survey, SurveyType
from app.services.patient_metrics import (
    adherence_percent,
    get_adherence_bulk,
    get_alerts_bulk,
    get_patient_alert,
    get_patient_metrics,
    get_wellbeing_status,
    wellbeing_reasons,
)
from tests import seed_data

ANA = UUID(seed_data.PATIENT_ANA_ID)
PEDRO = UUID(seed_data.PATIENT_PEDRO_ID)
ROUTINE = UUID(seed_data.ROUTINE_ID)


def _session(db, patient_id, days_ago=0, completed=True):
    when = now_utc() - timedelta(days=days_ago)
    s = SessionModel(
        patient_id=patient_id, routine_id=ROUTINE, date=when, is_completed=completed, completed_at=when if completed else None
    )
    db.add(s)
    db.flush()
    return s


def test_new_patient_is_not_an_alert(db):
    info = get_alerts_bulk(db, [ANA])[ANA]
    assert info.is_new is True
    assert info.has_alert is False
    assert get_patient_alert(db, seed_data.PATIENT_ANA_ID) == (False, None)


def test_inactive_more_than_5_days(db):
    _session(db, ANA, days_ago=6)
    info = get_alerts_bulk(db, [ANA])[ANA]
    assert info.has_alert is True
    assert "Inactivo" in info.message
    assert info.is_new is False


def test_recent_session_no_alert(db):
    _session(db, ANA, days_ago=1)
    assert get_alerts_bulk(db, [ANA])[ANA].has_alert is False


def _surveys(db, session, pre=None, post=None):
    if pre is not None:
        db.add(Survey(session_id=session.id, type=SurveyType.PRE_SESSION, **pre))
    if post is not None:
        db.add(Survey(session_id=session.id, type=SurveyType.POST_SESSION, **post))
    db.flush()


def test_wellbeing_reasons_thresholds():
    ok_pre = Survey(pain_level=3, fatigue_level=3, stress_level=3)
    ok_post = Survey(mood_level=3, pain_level=3)
    assert wellbeing_reasons(ok_pre, ok_post) == []
    assert wellbeing_reasons(None, None) == []
    bad_pre = Survey(pain_level=4, fatigue_level=5, stress_level=4)
    bad_post = Survey(mood_level=2, pain_level=5)
    assert wellbeing_reasons(bad_pre, bad_post) == [
        "Dolor alto antes de la sesión",
        "Dolor alto después de la sesión",
        "Ánimo bajo después de la sesión",
        "Cansancio alto",
        "Estrés alto",
    ]


def test_high_pain_in_last_session_then_clears(db):
    monday = _session(db, ANA, days_ago=1)
    _surveys(db, monday, pre={"pain_level": 5, "fatigue_level": 2})
    info = get_alerts_bulk(db, [ANA])[ANA]
    assert info.has_alert is True
    assert info.kind == "wellbeing"
    assert info.message == "Dolor alto antes de la sesión"

    # Una sesión posterior SIN encuestas no cierra la alerta (no hay datos nuevos).
    _session(db, ANA, days_ago=0)
    assert get_alerts_bulk(db, [ANA])[ANA].has_alert is True

    # La siguiente sesión con encuestas sin métricas en rojo sí la cierra.
    tuesday = _session(db, ANA, days_ago=0)
    _surveys(db, tuesday, pre={"pain_level": 2, "fatigue_level": 2}, post={"mood_level": 4})
    info = get_alerts_bulk(db, [ANA])[ANA]
    assert info.has_alert is False
    assert info.reasons == []


def test_post_survey_counts_for_wellbeing(db):
    s = _session(db, ANA, days_ago=0)
    _surveys(db, s, pre={"pain_level": 1, "fatigue_level": 1}, post={"mood_level": 1, "pain_level": 4})
    info = get_alerts_bulk(db, [ANA])[ANA]
    assert info.reasons == ["Dolor alto después de la sesión", "Ánimo bajo después de la sesión"]
    assert info.message == "Dolor alto después de la sesión · Ánimo bajo después de la sesión"


def test_wellbeing_beats_inactivity(db):
    old = _session(db, ANA, days_ago=8)
    _surveys(db, old, pre={"pain_level": 1, "fatigue_level": 1, "stress_level": 5})
    info = get_alerts_bulk(db, [ANA])[ANA]
    assert info.kind == "wellbeing"
    assert info.message == "Estrés alto"


def test_wellbeing_status_for_record(db):
    assert get_wellbeing_status(db, ANA) is None
    s = _session(db, ANA, days_ago=0)
    _surveys(db, s, pre={"pain_level": 2, "fatigue_level": 4}, post={"mood_level": 5})
    status = get_wellbeing_status(db, ANA)
    assert status.session_id == str(s.id)
    assert status.has_alert is True
    assert status.reasons == ["Cansancio alto"]
    assert status.pre_survey.fatigue_level == 4
    assert status.post_survey.mood_level == 5


def test_adherence_bulk_and_rounding(db):
    _session(db, ANA, completed=True)
    _session(db, ANA, completed=False)
    _session(db, ANA, completed=False)
    result = get_adherence_bulk(db, [ANA, PEDRO])
    assert result[ANA] == (1, 3)
    assert adherence_percent(*result[ANA]) == 33
    assert adherence_percent(0, 0) == 0
    assert get_adherence_bulk(db, []) == {}


def test_metrics_week_and_streak(db):
    _session(db, ANA, days_ago=0)
    _session(db, ANA, days_ago=1)
    _session(db, ANA, days_ago=2)
    _session(db, ANA, days_ago=10)  # rompe la racha
    m = get_patient_metrics(db, ANA)
    assert m.sessionsCompleted == 4
    assert m.currentStreakDays == 3
    assert 1 <= m.sessionsCompletedThisWeek <= 3


def test_streak_zero_if_last_was_long_ago(db):
    _session(db, ANA, days_ago=4)
    assert get_patient_metrics(db, ANA).currentStreakDays == 0
