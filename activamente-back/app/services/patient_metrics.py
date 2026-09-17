"""
Lógica de dominio de pacientes compartida entre routers (patients, specialists, me).

Todo lo que se calcula para MUCHOS pacientes tiene una versión *_bulk con
queries agregadas (EP-10): el dashboard del especialista y la lista "Mis
pacientes" no hacen N+1.

Fechas: sessions.date es TIMESTAMPTZ (UTC). "Hoy" y "esta semana" se calculan en
APP_TIMEZONE (app/core/config.py), no en la zona del contenedor.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.config import LOCAL_TZ, now_utc, today_local
from app.models.routine_model import Routine
from app.models.session_exercise_model import SessionExercise
from app.models.session_model import Session as SessionModel
from app.models.survey_model import Survey, SurveyType
from app.schemas.patient_schema import ComplianceMetrics, SessionItem, SurveySummary, WellbeingStatus

# Umbrales de bienestar (escala 1-5, R-02). Dolor, cansancio y estrés: 4-5 es
# "en rojo". Ánimo: 1-2 es "en rojo" (la escala va de muy mal a muy bien).
PAIN_ALERT_THRESHOLD = 4
HIGH_LEVEL_THRESHOLD = 4
LOW_MOOD_THRESHOLD = 2
INACTIVE_AFTER_DAYS = 5


@dataclass
class AlertInfo:
    has_alert: bool = False
    message: str | None = None
    # "wellbeing" (encuestas de la última sesión) | "inactive" | None
    kind: str | None = None
    reasons: list[str] = field(default_factory=list)
    is_new: bool = False
    last_session_date: datetime | None = None
    # Última sesión con encuesta: de ahí salen las razones de bienestar.
    survey_session_id: UUID | None = None
    survey_session_date: datetime | None = None
    pre_survey: Survey | None = None
    post_survey: Survey | None = None


def wellbeing_reasons(pre: Survey | None, post: Survey | None) -> list[str]:
    """Métricas "en rojo" de UNA sesión, en orden de importancia clínica."""
    reasons: list[str] = []
    if pre is not None and (pre.pain_level or 0) >= PAIN_ALERT_THRESHOLD:
        reasons.append("Dolor alto antes de la sesión")
    if post is not None and (post.pain_level or 0) >= PAIN_ALERT_THRESHOLD:
        reasons.append("Dolor alto después de la sesión")
    if post is not None and post.mood_level is not None and post.mood_level <= LOW_MOOD_THRESHOLD:
        reasons.append("Ánimo bajo después de la sesión")
    if pre is not None and (pre.fatigue_level or 0) >= HIGH_LEVEL_THRESHOLD:
        reasons.append("Cansancio alto")
    if pre is not None and (pre.stress_level or 0) >= HIGH_LEVEL_THRESHOLD:
        reasons.append("Estrés alto")
    return reasons


# ─── Alertas ──────────────────────────────────────────────────────────────────


def get_alerts_bulk(db: Session, patient_ids: list[UUID]) -> dict[UUID, AlertInfo]:
    """
    Alerta por paciente en 3 queries (no N+1). Criterios, en orden de prioridad:
      1. Bienestar: alguna métrica "en rojo" en las encuestas de la ÚLTIMA sesión
         que tenga encuesta. Solo cuenta esa sesión: si la siguiente viene sin
         métricas en rojo, la alerta desaparece.
      2. Última sesión hace más de INACTIVE_AFTER_DAYS días.
    Un paciente sin sesiones NO es alerta: es "nuevo" (is_new) (EP-09).
    """
    if not patient_ids:
        return {}

    last_dates = dict(
        db.query(SessionModel.patient_id, func.max(SessionModel.date))
        .filter(SessionModel.patient_id.in_(patient_ids))
        .group_by(SessionModel.patient_id)
        .all()
    )

    # DISTINCT ON (patient_id): la sesión más reciente con al menos una encuesta.
    surveyed = (
        db.query(SessionModel.patient_id, SessionModel.id, SessionModel.date)
        .join(Survey, Survey.session_id == SessionModel.id)
        .filter(SessionModel.patient_id.in_(patient_ids))
        .distinct(SessionModel.patient_id)
        .order_by(SessionModel.patient_id, SessionModel.date.desc())
        .all()
    )
    surveys: dict[tuple[UUID, SurveyType], Survey] = {}
    if surveyed:
        surveys = {
            (sv.session_id, sv.type): sv
            for sv in db.query(Survey).filter(Survey.session_id.in_([row.id for row in surveyed])).all()
        }
    surveyed_by_patient = {row.patient_id: row for row in surveyed}

    now = now_utc()
    result: dict[UUID, AlertInfo] = {}
    for pid in patient_ids:
        last_date = last_dates.get(pid)
        if last_date is None:
            result[pid] = AlertInfo(is_new=True)
            continue
        info = AlertInfo(last_session_date=last_date)
        row = surveyed_by_patient.get(pid)
        if row is not None:
            info.survey_session_id = row.id
            info.survey_session_date = row.date
            info.pre_survey = surveys.get((row.id, SurveyType.PRE_SESSION))
            info.post_survey = surveys.get((row.id, SurveyType.POST_SESSION))
            info.reasons = wellbeing_reasons(info.pre_survey, info.post_survey)
        if info.reasons:
            info.has_alert = True
            info.kind = "wellbeing"
            info.message = " · ".join(info.reasons)
        elif (now - last_date) > timedelta(days=INACTIVE_AFTER_DAYS):
            info.has_alert = True
            info.kind = "inactive"
            info.message = f"Inactivo por más de {INACTIVE_AFTER_DAYS} días"
        result[pid] = info
    return result


def get_patient_alert(db: Session, patient_id) -> tuple[bool, str | None]:
    """Compat: (has_alert, message) de un solo paciente."""
    pid = patient_id if isinstance(patient_id, UUID) else UUID(str(patient_id))
    info = get_alerts_bulk(db, [pid]).get(pid, AlertInfo(is_new=True))
    return info.has_alert, info.message


def get_wellbeing_status(db: Session, patient_id: UUID) -> WellbeingStatus | None:
    """Estado de bienestar para la ficha: encuestas de la última sesión con encuesta."""
    info = get_alerts_bulk(db, [patient_id])[patient_id]
    if info.survey_session_id is None:
        return None
    return WellbeingStatus(
        session_id=str(info.survey_session_id),
        date=info.survey_session_date,
        has_alert=bool(info.reasons),
        reasons=info.reasons,
        pre_survey=_survey_summary(info.pre_survey),
        post_survey=_survey_summary(info.post_survey),
    )


# ─── Adherencia ───────────────────────────────────────────────────────────────


def get_adherence_bulk(db: Session, patient_ids: list[UUID]) -> dict[UUID, tuple[int, int]]:
    """{patient_id: (completadas, totales)} en una query con GROUP BY."""
    if not patient_ids:
        return {}
    rows = (
        db.query(
            SessionModel.patient_id,
            func.count(SessionModel.id),
            func.coalesce(func.sum(case((SessionModel.is_completed.is_(True), 1), else_=0)), 0),
        )
        .filter(SessionModel.patient_id.in_(patient_ids))
        .group_by(SessionModel.patient_id)
        .all()
    )
    result = {pid: (0, 0) for pid in patient_ids}
    for pid, total, completed in rows:
        result[pid] = (int(completed), int(total))
    return result


def adherence_percent(completed: int, total: int) -> int:
    return round(completed / total * 100) if total > 0 else 0


def _local_date(dt: datetime | None) -> date | None:
    return dt.astimezone(LOCAL_TZ).date() if dt else None


def get_patient_metrics(db: Session, patient_id: UUID) -> ComplianceMetrics:
    completed, total = get_adherence_bulk(db, [patient_id])[patient_id]

    today = today_local()
    week_start = today - timedelta(days=today.weekday())  # lunes

    completed_dates = [
        _local_date(d)
        for (d,) in db.query(SessionModel.completed_at)
        .filter(SessionModel.patient_id == patient_id, SessionModel.is_completed.is_(True))
        .order_by(SessionModel.completed_at.desc())
        .all()
        if d is not None
    ]
    this_week = sum(1 for d in completed_dates if d >= week_start)

    # Racha: días consecutivos con sesión completada terminando hoy o ayer.
    streak = 0
    unique_days = sorted(set(completed_dates), reverse=True)
    if unique_days and (today - unique_days[0]).days <= 1:
        cursor = unique_days[0]
        for d in unique_days:
            if d == cursor:
                streak += 1
                cursor = cursor - timedelta(days=1)
            else:
                break

    return ComplianceMetrics(
        sessionsCompleted=completed,
        sessionsTotal=total,
        adherencePercent=adherence_percent(completed, total),
        sessionsCompletedThisWeek=this_week,
        currentStreakDays=streak,
    )


# ─── Historial de sesiones ────────────────────────────────────────────────────


def _survey_summary(survey: Survey | None) -> SurveySummary | None:
    if survey is None:
        return None
    return SurveySummary(
        pain_level=survey.pain_level,
        fatigue_level=survey.fatigue_level,
        stress_level=survey.stress_level,
        mood_level=survey.mood_level,
        comments=survey.comments,
    )


def get_patient_sessions(db: Session, patient_id: UUID, limit: int = 10, offset: int = 0) -> list[SessionItem]:
    rows = (
        db.query(SessionModel, Routine.name)
        .outerjoin(Routine, SessionModel.routine_id == Routine.id)
        .filter(SessionModel.patient_id == patient_id)
        .order_by(SessionModel.date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    if not rows:
        return []

    session_ids = [s.id for s, _ in rows]

    exercise_counts = {
        sid: (int(total), int(done))
        for sid, total, done in db.query(
            SessionExercise.session_id,
            func.count(SessionExercise.id),
            func.coalesce(func.sum(case((SessionExercise.reps_completed > 0, 1), else_=0)), 0),
        )
        .filter(SessionExercise.session_id.in_(session_ids))
        .group_by(SessionExercise.session_id)
        .all()
    }

    surveys: dict[tuple[UUID, SurveyType], Survey] = {
        (s.session_id, s.type): s for s in db.query(Survey).filter(Survey.session_id.in_(session_ids)).all()
    }

    items: list[SessionItem] = []
    for session, routine_name in rows:
        total, done = exercise_counts.get(session.id, (0, 0))
        items.append(
            SessionItem(
                id=str(session.id),
                name=routine_name or "Sesión",
                date=session.date,
                completed_at=session.completed_at,
                duration_minutes=session.duration_minutes,
                completed=bool(session.is_completed),
                exercises_total=total,
                exercises_done=done,
                pre_survey=_survey_summary(surveys.get((session.id, SurveyType.PRE_SESSION))),
                post_survey=_survey_summary(surveys.get((session.id, SurveyType.POST_SESSION))),
            )
        )
    return items


def get_patient_metrics_and_sessions(db: Session, patient_id) -> tuple[ComplianceMetrics, list[SessionItem]]:
    pid = patient_id if isinstance(patient_id, UUID) else UUID(str(patient_id))
    return get_patient_metrics(db, pid), get_patient_sessions(db, pid, limit=10)
