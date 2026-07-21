"""
Lógica de dominio de pacientes compartida entre routers.

`get_patient_alert` y `get_patient_metrics_and_sessions` viven acá (y no en
`routers/patients.py`) para que `routers/specialists.py` las reutilice sin
importar de otro router (que acoplaba dos routers e importaba una función
"privada" con guion bajo). Ahora ambos routers dependen de este módulo de
servicio, no uno del otro.
"""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.session import Session as SessionModel
from app.models.survey_model import Survey
from app.models.routine_model import Routine
from app.schemas.patient_schema import ComplianceMetrics, SessionItem


def get_patient_alert(db: Session, patient_id):
    """
    Calcula si un paciente tiene una alerta activa y su mensaje. Criterios
    (en orden): última sesión hace más de 5 días -> inactivo; encuesta
    PRE de la última sesión con pain_level > 7 -> dolor alto; sin sesiones
    -> sin registros. Devuelve (has_alert, alert_message).
    """
    has_alert = False
    alert_message = None

    last_session = db.query(SessionModel).filter(SessionModel.patient_id == patient_id).order_by(SessionModel.date.desc()).first()

    if last_session:
        if last_session.date and (datetime.now() - last_session.date) > timedelta(days=5):
            has_alert = True
            alert_message = "Inactivo por más de 5 días"

        last_survey = db.query(Survey).filter(Survey.session_id == last_session.id).first()
        if last_survey and last_survey.pain_level and last_survey.pain_level > 7:
            has_alert = True
            alert_message = "Nivel de dolor alto"
    else:
        has_alert = True
        alert_message = "Sin sesiones registradas"

    return has_alert, alert_message


def get_patient_metrics_and_sessions(db: Session, patient_id: str):
    all_sessions = db.query(SessionModel).filter(SessionModel.patient_id == patient_id).all()

    total_sessions = len(all_sessions)
    completed_sessions = sum(1 for s in all_sessions if s.is_completed)
    adherence = int((completed_sessions / total_sessions * 100) if total_sessions > 0 else 0)

    metrics = ComplianceMetrics(
        sessionsCompleted=completed_sessions,
        sessionsTotal=total_sessions,
        adherencePercent=adherence
    )

    recent_sessions = db.query(SessionModel, Routine).outerjoin(
        Routine, SessionModel.routine_id == Routine.id
    ).filter(
        SessionModel.patient_id == patient_id
    ).order_by(SessionModel.date.desc()).limit(10).all()

    sessions_list = []
    for s, r in recent_sessions:
        duration_str = f"{s.duration_minutes} min" if s.duration_minutes else "N/A"
        date_str = s.date.strftime("%d %b · %H:%M") if s.date else "Desconocido"
        sessions_list.append(
            SessionItem(
                id=str(s.id),
                name=r.name if r and r.name else "Sesión",
                duration=duration_str,
                date=date_str,
                completed=s.is_completed or False
            )
        )

    return metrics, sessions_list
