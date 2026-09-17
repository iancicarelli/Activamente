"""Unit sin DB: validadores Pydantic (lo que devuelve 422 antes de tocar la base)."""

from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas.appointment_schema import AppointmentCreate
from app.schemas.auth_schema import ChangePasswordRequest, LoginRequest
from app.schemas.routine_schema import RoutineCreate, RoutineExerciseCreate
from app.schemas.session_exercise_schema import SessionExerciseUpdate
from app.schemas.survey_schema import SurveyCreatePost, SurveyCreatePre
from app.schemas.user_schema import CreateUserRequest, role_from_str

PID = "90bcc710-3984-4f86-8570-772ac433d7cd"
SID = "90a1aeee-c904-439f-ba34-1a3c9dfc2a41"


def _routine(**over):
    body = {
        "patient_id": PID,
        "name": "R",
        "start_date": "2026-01-01",
        "end_date": "2026-02-01",
        "days_of_week": [3, 1],
        "exercises": [{"exercise_id": "squat", "order_index": 0}],
    }
    body.update(over)
    return RoutineCreate(**body)


def test_login_needs_email_or_rut():
    assert LoginRequest(email="a@b.cl", password="x").email == "a@b.cl"
    assert LoginRequest(rut="1-9", password="x").rut == "1-9"
    with pytest.raises(ValidationError):
        LoginRequest(password="x")
    with pytest.raises(ValidationError):
        LoginRequest(email="no-es-email", password="x")
    with pytest.raises(ValidationError):
        LoginRequest(email="a@b.cl", password="")


def test_change_password_min_length():
    with pytest.raises(ValidationError):
        ChangePasswordRequest(current_password="x", new_password="12345")
    assert ChangePasswordRequest(current_password="x", new_password="123456").new_password == "123456"


def test_routine_days_sorted_unique_and_range():
    assert _routine().days_of_week == [1, 3]
    with pytest.raises(ValidationError, match="repetido"):
        _routine(days_of_week=[1, 1])
    with pytest.raises(ValidationError):
        _routine(days_of_week=[0])
    with pytest.raises(ValidationError):
        _routine(days_of_week=[8])
    with pytest.raises(ValidationError):
        _routine(days_of_week=[])


def test_routine_dates_and_exercises():
    with pytest.raises(ValidationError, match="anterior"):
        _routine(start_date="2026-02-02")
    with pytest.raises(ValidationError, match="order_index"):
        _routine(exercises=[{"exercise_id": "squat", "order_index": 0}, {"exercise_id": "toe_touch", "order_index": 0}])
    with pytest.raises(ValidationError, match="repetido"):
        _routine(exercises=[{"exercise_id": "squat", "order_index": 0}, {"exercise_id": "squat", "order_index": 1}])
    with pytest.raises(ValidationError):
        _routine(exercises=[])


@pytest.mark.parametrize(
    "field,value",
    [("level", 0), ("level", 4), ("total_series", 11), ("total_reps", 0), ("rest_time_seconds", -1), ("order_index", -1)],
)
def test_routine_exercise_ranges(field, value):
    kwargs = {"exercise_id": "squat", "order_index": 0, field: value}
    with pytest.raises(ValidationError):
        RoutineExerciseCreate(**kwargs)


@pytest.mark.parametrize("value", [0, 6])
def test_survey_scale_is_1_to_5(value):
    with pytest.raises(ValidationError):
        SurveyCreatePre(session_id=SID, pain_level=value, fatigue_level=3)
    with pytest.raises(ValidationError):
        SurveyCreatePost(session_id=SID, mood_level=value)


def test_survey_optional_fields_and_comment_limit():
    assert SurveyCreatePre(session_id=SID, pain_level=1, fatigue_level=5).stress_level is None
    with pytest.raises(ValidationError):
        SurveyCreatePost(session_id=SID, mood_level=3, comments="x" * 501)


def test_session_exercise_update_ranges():
    assert SessionExerciseUpdate(series_completed=1, reps_completed=5, accuracy_score=99.5).accuracy_score == 99.5
    with pytest.raises(ValidationError):
        SessionExerciseUpdate(series_completed=1, reps_completed=5, accuracy_score=101)
    with pytest.raises(ValidationError):
        SessionExerciseUpdate(series_completed=-1, reps_completed=0)
    with pytest.raises(ValidationError):
        SessionExerciseUpdate(series_completed=0, reps_completed=0, feedback="x" * 301)


def test_appointment_types():
    a = AppointmentCreate(patient_id=PID, date="2030-01-01", time_slot="10:30:00")
    assert a.date == date(2030, 1, 1) and a.time_slot.hour == 10
    with pytest.raises(ValidationError):
        AppointmentCreate(patient_id=PID, date="ayer", time_slot="10:30:00")
    with pytest.raises(ValidationError):
        AppointmentCreate(patient_id="no-uuid", date="2030-01-01", time_slot="10:30:00")


def test_user_role_mapping_and_name_split():
    assert role_from_str("paciente").value == "PATIENT"
    assert role_from_str(" Especialista ").value == "SPECIALIST"
    assert role_from_str("admin").value == "ADMIN"
    assert role_from_str("SPECIALIST").value == "SPECIALIST"
    with pytest.raises(ValueError):
        role_from_str("superuser")
    req = CreateUserRequest(fullName="  Ana María Pérez ", email="a@b.cl", role="paciente")
    assert req.split_name() == ("Ana", "María Pérez")
    with pytest.raises(ValidationError):
        CreateUserRequest(fullName="A", email="a@b.cl", role="paciente")
    with pytest.raises(ValidationError):
        CreateUserRequest(fullName="Ana", email="a@b.cl", role="paciente", age=121)
