"""
Registro de accesos del staff a datos de pacientes (Ley 21.719, 2026-09-25).

Cada vez que un ADMIN o SPECIALIST pasa por `assert_patient_access` (authz.py) se guarda una
fila en `access_log` con quién, a qué paciente, qué ruta y si se le permitió. Los pacientes que
miran sus propios datos no se registran. Los LISTADOS (p. ej. GET /api/patients/) no pasan por
authz y no quedan registrados: solo el acceso a un paciente concreto.

Se escribe con una sesión PROPIA y se commitea al instante: la sesión del request no siempre
commitea (los GET no lo hacen) y un 403 la descarta, pero el intento denegado es justamente lo
que más interesa guardar. Si la escritura falla, se registra en el log y el request sigue.

La ruta y el método llegan por un ContextVar que llena `AuditContextMiddleware`: authz.py no
recibe el Request, y así no hay que tocar cada endpoint.
"""

import logging
from contextvars import ContextVar

from starlette.types import ASGIApp, Receive, Scope, Send

from app.database import SessionLocal
from app.models.access_log_model import AccessLog
from app.models.user_model import User, UserRole

log = logging.getLogger(__name__)

_request: ContextVar[tuple[str, str] | None] = ContextVar("audit_request", default=None)

# Fábrica de sesiones del registro. Los tests la reemplazan para escribir dentro de su transacción.
session_factory = SessionLocal


class AuditContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        token = _request.set((scope.get("method", "?"), scope.get("path", "?")))
        try:
            await self.app(scope, receive, send)
        finally:
            _request.reset(token)


def record_patient_access(user: User, patient_id, allowed: bool) -> None:
    if user.role not in (UserRole.ADMIN, UserRole.SPECIALIST):
        return
    method, path = _request.get() or ("?", "?")
    db = session_factory()
    try:
        db.add(
            AccessLog(actor_id=user.id, actor_role=user.role, patient_id=patient_id, method=method, path=path, allowed=allowed)
        )
        db.commit()
    except Exception:
        db.rollback()
        log.exception("No se pudo registrar el acceso de %s al paciente %s", user.id, patient_id)
    finally:
        db.close()
