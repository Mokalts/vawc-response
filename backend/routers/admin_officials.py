from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models.barangay_official import BarangayOfficial, OfficialRole
from models.admin import Admin
from core.admin_dependencies import get_current_admin_full_access

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
    current_admin: Admin = Depends(get_current_admin_full_access),
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
    current_admin: Admin = Depends(get_current_admin_full_access),
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


@router.delete("/{official_id}")
def delete_official(
    official_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    """Remove an official outright.

    Safe to do, and worth saying why: a BPO stores `issued_by_official` and an
    endorsement stores `signed_by_official` as SNAPSHOT strings taken when the
    document was issued. Removing the person here does not touch a document
    that already carries their name, which is the thing that would actually
    matter.

    Deactivating is still the better move for someone who has left office,
    because it keeps the record of who used to hold the role. Deleting is for a
    row that should never have been added: a typo, a duplicate, the wrong name.
    """
    o = db.query(BarangayOfficial).filter(BarangayOfficial.id == official_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Official not found.")

    name, role = o.full_name, o.role.value if hasattr(o.role, "value") else o.role
    db.delete(o)
    db.commit()
    print(f"[OFFICIALS] removed {role}: {name}")
    return {"message": f"{name} removed."}
