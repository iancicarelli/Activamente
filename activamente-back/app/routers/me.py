"""GET /api/me — perfil genérico por rol (EP-14 / HC-03)."""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.admin_model import Admin
from app.models.patient_model import Patient
from app.models.specialist_model import Specialist
from app.models.specialist_patient_model import SpecialistPatient
from app.models.user_model import User, UserRole
from app.schemas.me_schema import MeAdmin, MePatient, MeResponse, MeSpecialist, SpecialistSummary

router = APIRouter(prefix="/api/me", tags=["me"])


def build_me(db: Session, user: User) -> MeResponse:
    response = MeResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )

    if user.role == UserRole.PATIENT:
        row = db.query(Patient).filter(Patient.user_id == user.id).first()
        specialists = (
            db.query(User, Specialist)
            .join(SpecialistPatient, SpecialistPatient.specialist_id == User.id)
            .outerjoin(Specialist, Specialist.user_id == User.id)
            .filter(SpecialistPatient.patient_id == user.id, User.is_active.is_(True))
            .order_by(SpecialistPatient.assigned_at.asc())
            .all()
        )
        response.patient = MePatient(
            rut=row.rut if row else None,
            age=row.age if row else None,
            gender=row.gender if row else None,
            phone=row.phone if row else None,
            address=row.address if row else None,
            specialists=[
                SpecialistSummary(
                    id=u.id,
                    full_name=u.full_name,
                    specialty=s.specialty if s else None,
                    phone=s.phone if s else None,
                    email=u.email,
                )
                for u, s in specialists
            ],
        )
    elif user.role == UserRole.SPECIALIST:
        row = db.query(Specialist).filter(Specialist.user_id == user.id).first()
        total = (
            db.query(func.count(SpecialistPatient.patient_id)).filter(SpecialistPatient.specialist_id == user.id).scalar()
        ) or 0
        response.specialist = MeSpecialist(
            rut=row.rut if row else None,
            specialty=row.specialty if row else None,
            phone=row.phone if row else None,
            total_patients=int(total),
        )
    else:
        row = db.query(Admin).filter(Admin.user_id == user.id).first()
        response.admin = MeAdmin(job_title=row.job_title if row else None, phone=row.phone if row else None)

    return response


@router.get("", response_model=MeResponse)
def get_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return build_me(db, current_user)
