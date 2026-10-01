from fastapi import APIRouter
from sqlalchemy import select

from app.auth.deps import DbSession
from app.auth.schemas import BarangayOut
from app.models import Barangay

router = APIRouter(tags=["locations"])


@router.get("/barangays", response_model=list[BarangayOut])
def list_barangays(db: DbSession) -> list[Barangay]:
    """Public list of Dalaguete barangays (needed by the registration form)."""
    return list(db.scalars(select(Barangay).order_by(Barangay.name)))
