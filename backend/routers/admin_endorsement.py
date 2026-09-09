from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database import get_db
from models.case import Case
from models.report import ReportStatus
from models.endorsement import Endorsement, EndorsementOffice
from models.barangay_official import BarangayOfficial, OfficialRole
from models.admin import Admin
from core.admin_dependencies import get_current_admin_full_access
from core.status_labels import ENDORSEMENT_OFFICE_DISPLAY
from core.case_status import recompute_case_status

router = APIRouter(prefix="/admin", tags=["Admin Endorsement"])


class EndorsementCreate(BaseModel):
    to_office: str
    to_office_other: Optional[str] = None
    purpose: Optional[str] = None
    attached_documents: List[str] = []
    date_endorsed: Optional[str] = None   # ISO; defaults to now

class EndorsementAck(BaseModel):
    received_by: str
    received_at: Optional[str] = None     # ISO; defaults to now
    receipt_proof: Optional[str] = None


def _active_official(db, role):
    o = db.query(BarangayOfficial).filter(
        BarangayOfficial.role == role, BarangayOfficial.is_active == True
    ).first()
    return o.full_name if o else None


def _serialize(e: Endorsement) -> dict:
    return {
        "id": e.id, "case_id": e.case_id, "endorsement_number": e.endorsement_number,
        "to_office": e.to_office.value if e.to_office else None,
        "to_office_display": ENDORSEMENT_OFFICE_DISPLAY.get(e.to_office.value if e.to_office else None),
        "to_office_other": e.to_office_other, "purpose": e.purpose,
        "attached_documents": e.attached_documents or [],
        "date_endorsed": e.date_endorsed, "signed_by_official": e.signed_by_official,
        "received_by": e.received_by, "received_at": e.received_at, "receipt_proof": e.receipt_proof,
        "acknowledged": e.received_at is not None, "created_at": e.created_at,
    }


# ── POST /admin/cases/{case_id}/endorsements ──────────────────────────────────
@router.post("/cases/{case_id}/endorsements")
def create_endorsement(
    case_id: int,
    payload: EndorsementCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    case = db.query(Case).filter(Case.id == case_id, Case.is_deleted == False).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    try:
        office = EndorsementOffice(payload.to_office)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid office. Valid: {[o.value for o in EndorsementOffice]}")

    next_no = (max([e.endorsement_number for e in case.endorsements], default=0)) + 1
    when = datetime.utcnow()
    if payload.date_endorsed:
        try:
            when = datetime.fromisoformat(payload.date_endorsed.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            pass

    e = Endorsement(
        case_id=case.id,
        endorsement_number=next_no,
        to_office=office,
        to_office_other=payload.to_office_other,
        purpose=payload.purpose,
        attached_documents=payload.attached_documents or [],
        date_endorsed=when,
        signed_by_official=_active_official(db, OfficialRole.punong_barangay),
    )
    db.add(e)
    case.status = ReportStatus.endorsed
    case.admin_id = current_admin.id
    case.has_status_update = True
    case.updated_at = datetime.utcnow()
    db.commit(); db.refresh(e)
    return {"message": "Endorsement created.", "endorsement": _serialize(e)}


# ── PATCH /admin/endorsements/{id}/acknowledge ────────────────────────────────
@router.patch("/endorsements/{endorsement_id}/acknowledge")
def acknowledge_endorsement(
    endorsement_id: int,
    payload: EndorsementAck,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    """An endorsement is not complete until it is acknowledged by the receiving office."""
    e = db.query(Endorsement).filter(Endorsement.id == endorsement_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Endorsement not found.")
    when = datetime.utcnow()
    if payload.received_at:
        try:
            when = datetime.fromisoformat(payload.received_at.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            pass
    e.received_by = payload.received_by
    e.received_at = when
    e.receipt_proof = payload.receipt_proof
    db.commit(); db.refresh(e)
    return {"message": "Endorsement acknowledged.", "endorsement": _serialize(e)}


# ── PATCH /admin/endorsements/{id}/unacknowledge ──────────────────────────────
@router.patch("/endorsements/{endorsement_id}/unacknowledge")
def unacknowledge_endorsement(
    endorsement_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    """Undo an acknowledgment recorded by mistake."""
    e = db.query(Endorsement).filter(Endorsement.id == endorsement_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Endorsement not found.")
    if not e.received_at:
        raise HTTPException(status_code=409, detail="This endorsement is not acknowledged.")
    e.received_by = None; e.received_at = None; e.receipt_proof = None
    db.commit(); db.refresh(e)
    return {"message": "Acknowledgment removed.", "endorsement": _serialize(e)}


# ── DELETE /admin/endorsements/{id} ───────────────────────────────────────────
@router.delete("/endorsements/{endorsement_id}")
def delete_endorsement(
    endorsement_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    """Remove an endorsement created by mistake, and step the case back."""
    e = db.query(Endorsement).filter(Endorsement.id == endorsement_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Endorsement not found.")
    case = db.query(Case).filter(Case.id == e.case_id).first()
    db.delete(e); db.flush()
    if case:
        db.refresh(case)
        case.status = recompute_case_status(case)
        case.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Endorsement deleted."}
