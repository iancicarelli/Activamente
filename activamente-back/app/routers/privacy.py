"""
Privacidad (Ley 21.719, 2026-09-25):

  GET  /api/me/terms                                 términos vigentes para mi rol + si los acepté
  POST /api/me/terms                                 aceptar la versión vigente
  GET  /api/me/deletion-request                      mi última solicitud de eliminación (o null)
  POST /api/me/deletion-request                      pedir que borren mi cuenta (solo pacientes)
  GET  /api/admins/deletion-requests                 solicitudes (filtro ?status=)
  POST /api/admins/deletion-requests/{id}/approve    BORRA al paciente y todos sus datos
  POST /api/admins/deletion-requests/{id}/reject
  GET  /api/admins/access-log                        quién accedió a qué paciente (?patient_id, ?actor_id)

Las dos primeras funcionan sin haber aceptado los términos (las demás pasan por get_current_user,
que los exige).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import now_utc
from app.core.deps import get_current_user_pending_terms, require_admin, require_patient
from app.core.terms import TERMS_VERSION, terms_for_role
from app.database import get_db
from app.models.access_log_model import AccessLog
from app.models.appointment_model import Appointment
from app.models.deletion_request_model import APPROVED, PENDING, REJECTED, DeletionRequest
from app.models.patient_model import Patient
from app.models.terms_acceptance_model import TermsAcceptance
from app.models.user_model import User, UserRole
from app.schemas.privacy_schema import (
    AcceptTermsRequest,
    AccessLogItem,
    DeletionRequestAdminItem,
    DeletionRequestCreate,
    DeletionRequestOut,
    TermsSection,
    TermsStatus,
)

router = APIRouter(tags=["privacy"])


# ── Términos ──────────────────────────────────────────────────────────────────


@router.get("/api/me/terms", response_model=TermsStatus)
def get_my_terms(db: Session = Depends(get_db), user: User = Depends(get_current_user_pending_terms)):
    row = db.query(TermsAcceptance).filter(TermsAcceptance.user_id == user.id, TermsAcceptance.version == TERMS_VERSION).first()
    return TermsStatus(
        version=TERMS_VERSION,
        accepted=row is not None,
        accepted_at=row.accepted_at if row else None,
        sections=[TermsSection(**s) for s in terms_for_role(user.role.value)],
    )


@router.post("/api/me/terms", status_code=status.HTTP_204_NO_CONTENT)
def accept_my_terms(
    body: AcceptTermsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_pending_terms),
):
    """Acepta la versión VIGENTE. Si la app manda otra (el texto cambió mientras la persona lo
    leía), 409: que vuelva a cargar y lea la nueva."""
    if body.version != TERMS_VERSION:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Los términos se actualizaron mientras los leías. Vuelve a abrirlos para ver la versión nueva.",
        )
    exists = (
        db.query(TermsAcceptance.user_id)
        .filter(TermsAcceptance.user_id == user.id, TermsAcceptance.version == TERMS_VERSION)
        .first()
    )
    if exists is None:
        db.add(TermsAcceptance(user_id=user.id, version=TERMS_VERSION))
        db.commit()


# ── Eliminación de cuenta (paciente) ─────────────────────────────────────────


def _out(r: DeletionRequest) -> DeletionRequestOut:
    return DeletionRequestOut(id=r.id, status=r.status, requested_at=r.requested_at, resolved_at=r.resolved_at)


@router.get("/api/me/deletion-request", response_model=DeletionRequestOut | None)
def get_my_deletion_request(db: Session = Depends(get_db), patient: User = Depends(require_patient)):
    r = (
        db.query(DeletionRequest)
        .filter(DeletionRequest.user_id == patient.id)
        .order_by(DeletionRequest.requested_at.desc())
        .first()
    )
    return _out(r) if r else None


@router.post("/api/me/deletion-request", response_model=DeletionRequestOut, status_code=status.HTTP_201_CREATED)
def request_my_deletion(
    body: DeletionRequestCreate,
    db: Session = Depends(get_db),
    patient: User = Depends(require_patient),
):
    r = DeletionRequest(user_id=patient.id, status=PENDING, reason=(body.reason or "").strip() or None)
    db.add(r)
    try:
        db.commit()
    except IntegrityError as e:  # uq_deletion_requests_pending
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ya tienes una solicitud de eliminación en revisión."
        ) from e
    db.refresh(r)
    return _out(r)


# ── Eliminación de cuenta (admin) ────────────────────────────────────────────


@router.get("/api/admins/deletion-requests", response_model=list[DeletionRequestAdminItem])
def list_deletion_requests(
    status_filter: str | None = Query(default=None, alias="status", pattern="^(PENDING|APPROVED|REJECTED)$"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    q = (
        db.query(DeletionRequest, User, Patient)
        .outerjoin(User, User.id == DeletionRequest.user_id)
        .outerjoin(Patient, Patient.user_id == DeletionRequest.user_id)
    )
    if status_filter:
        q = q.filter(DeletionRequest.status == status_filter)
    rows = q.order_by(DeletionRequest.requested_at.desc()).limit(200).all()
    return [
        DeletionRequestAdminItem(
            **_out(r).model_dump(),
            user_id=r.user_id,
            reason=r.reason,
            full_name=u.full_name if u else None,
            email=u.email if u else None,
            rut=p.rut if p else None,
        )
        for r, u, p in rows
    ]


def _pending_or_404(db: Session, request_id: UUID) -> DeletionRequest:
    r = db.query(DeletionRequest).filter(DeletionRequest.id == request_id).first()
    if r is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if r.status != PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Esta solicitud ya fue resuelta.")
    return r


def _resolve(r: DeletionRequest, new_status: str, admin: User) -> None:
    r.status = new_status
    r.resolved_at = now_utc()
    r.resolved_by = admin.id


@router.post("/api/admins/deletion-requests/{request_id}/approve", response_model=DeletionRequestOut)
def approve_deletion_request(request_id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Borra DEFINITIVAMENTE al paciente y todos sus datos. En la base, ON DELETE CASCADE se lleva
    perfil, asignaciones, rutinas, sesiones (y sus ejercicios y encuestas) y términos aceptados;
    las citas tienen SET NULL, así que se borran a mano antes. El registro de accesos se conserva
    (solo guarda ids). El motivo de la solicitud se borra: podía contener datos personales."""
    r = _pending_or_404(db, request_id)
    user = db.query(User).filter(User.id == r.user_id).first()
    if user is not None:
        if user.role != UserRole.PATIENT:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se eliminan cuentas de pacientes.")
        db.query(Appointment).filter(Appointment.patient_id == user.id).delete(synchronize_session=False)
        db.query(User).filter(User.id == user.id).delete(synchronize_session=False)
    _resolve(r, APPROVED, admin)
    r.reason = None
    db.commit()
    db.refresh(r)
    return _out(r)


@router.post("/api/admins/deletion-requests/{request_id}/reject", response_model=DeletionRequestOut)
def reject_deletion_request(request_id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    r = _pending_or_404(db, request_id)
    _resolve(r, REJECTED, admin)
    db.commit()
    db.refresh(r)
    return _out(r)


# ── Registro de accesos ──────────────────────────────────────────────────────


@router.get("/api/admins/access-log", response_model=list[AccessLogItem])
def list_access_log(
    patient_id: UUID | None = None,
    actor_id: UUID | None = None,
    denied_only: bool = False,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    q = db.query(AccessLog, User).outerjoin(User, User.id == AccessLog.actor_id)
    if patient_id:
        q = q.filter(AccessLog.patient_id == patient_id)
    if actor_id:
        q = q.filter(AccessLog.actor_id == actor_id)
    if denied_only:
        q = q.filter(AccessLog.allowed.is_(False))
    rows = q.order_by(AccessLog.at.desc(), AccessLog.id.desc()).limit(limit).all()
    return [
        AccessLogItem(
            id=a.id,
            at=a.at,
            actor_id=a.actor_id,
            actor_name=u.full_name if u else None,
            actor_role=a.actor_role,
            patient_id=a.patient_id,
            method=a.method,
            path=a.path,
            allowed=a.allowed,
        )
        for a, u in rows
    ]
