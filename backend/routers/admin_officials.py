from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models.barangay_official import BarangayOfficial, OfficialRole
from models.admin import Admin
from core.admin_dependencies import get_current_admin_full_access, require_super_admin

router = APIRouter(prefix="/admin/officials", tags=["Admin Officials"])

ROLE_DISPLAY = {
    "punong_barangay": "Punong Barangay",
    "vawc_officer":    "VAWC Officer",
    "bsdo":            "BSDO",
    "secretary":       "Barangay Secretary",
}


class OfficialCreate(BaseModel):
    role: str
    full_name: str
    is_active: bool = True

class OfficialUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


def _serialize(o: BarangayOfficial) -> dict:
    return {
        "id": o.id, "role": o.role.value if o.role else None,
        "role_display": ROLE_DISPLAY.get(o.role.value if o.role else None),
        "full_name": o.full_name, "is_active": o.is_active,
        "term_start": o.term_start, "term_end": o.term_end,
    }


@router.get("")
def list_officials(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    officials = db.query(BarangayOfficial).order_by(BarangayOfficial.role, BarangayOfficial.id).all()
    return {"officials": [_serialize(o) for o in officials]}


@router.post("")
def create_official(
    payload: OfficialCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    try:
        role = OfficialRole(payload.role)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid role. Valid: {[r.value for r in OfficialRole]}")
    if not payload.full_name.strip():
        raise HTTPException(status_code=422, detail="Name is required.")
    o = BarangayOfficial(role=role, full_name=payload.full_name.strip(), is_active=payload.is_active)
    db.add(o); db.commit(); db.refresh(o)
    return {"message": "Official added.", "official": _serialize(o)}


@router.patch("/{official_id}")
def update_official(
    official_id: int,
    payload: OfficialUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    o = db.query(BarangayOfficial).filter(BarangayOfficial.id == official_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Official not found.")
    if payload.full_name is not None:
        if not payload.full_name.strip():
            raise HTTPException(status_code=422, detail="Name cannot be empty.")
        o.full_name = payload.full_name.strip()
    if payload.role is not None:
        try:
            o.role = OfficialRole(payload.role)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid role.")
    if payload.is_active is not None:
        o.is_active = payload.is_active
    db.commit(); db.refresh(o)
    return {"message": "Official updated.", "official": _serialize(o)}
