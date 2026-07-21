from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import require_admin
from app.models.user_model import User
from app.models.admin_model import Admin
from app.schemas.admin_schema import AdminMeResponse, AdminMeUpdate

router = APIRouter(prefix="/api/admins", tags=["admins"])


def _admin_response(user: User, row: Admin | None) -> AdminMeResponse:
    return AdminMeResponse(
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        job_title=row.job_title if row else None,
        phone=row.phone if row else None,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.get("/me", response_model=AdminMeResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Perfil propio del administrador logueado (datos de users + admin)."""
    row = db.query(Admin).filter(Admin.user_id == admin.id).first()
    return _admin_response(admin, row)


@router.patch("/me", response_model=AdminMeResponse)
def update_my_profile(
    body: AdminMeUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Actualiza el perfil propio (solo los campos presentes en el body).

    Los admins creados vía POST /api/users no traen fila en `admin`, así que
    hacemos upsert: si no existe, la creamos al primer PATCH.
    """
    row = db.query(Admin).filter(Admin.user_id == admin.id).first()
    if row is None:
        row = Admin(user_id=admin.id)
        db.add(row)

    data = body.model_dump(exclude_unset=True)
    if "first_name" in data:
        admin.first_name = data["first_name"]
    if "last_name" in data:
        admin.last_name = data["last_name"]
    if "job_title" in data:
        row.job_title = data["job_title"]
    if "phone" in data:
        row.phone = data["phone"]

    db.commit()
    db.refresh(admin)
    db.refresh(row)

    return _admin_response(admin, row)
