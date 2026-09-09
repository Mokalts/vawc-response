from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

from database import get_db
from models.case import Case
from models.bpo import BPO, BPOStatus
from models.report import ReportStatus
from models.barangay_official import BarangayOfficial, OfficialRole
from models.admin import Admin
from core.admin_dependencies import get_current_admin_full_access
from core.case_status import recompute_case_status

router = APIRouter(prefix="/admin", tags=["Admin BPO"])

BPO_VALID_DAYS = 15
EXPIRY_WARN_DAY = 12


# ── Schemas ───────────────────────────────────────────────────────────────────
class BPOCreate(BaseModel):
    control_number: Optional[str] = None
    relief_stop_physical_harm: bool = False
    relief_stop_threats: bool = False
    relief_stay_away_100m: bool = False

class BPOServe(BaseModel):
    served_by: Optional[str] = None
    served_at: Optional[str] = None          # ISO; defaults to now
    proof_of_service: Optional[str] = None   # Cloudinary URL


def _active_official(db, role):
    o = db.query(BarangayOfficial).filter(
        BarangayOfficial.role == role, BarangayOfficial.is_active == True
    ).first()
    return o.full_name if o else None


def _bpo_number(db) -> str:
    year = datetime.utcnow().year
    n = db.query(BPO).filter(BPO.bpo_number.like(f"BPO-{year}-%")).count()
    return f"BPO-{year}-{str(n + 1).zfill(3)}"


def _serialize(b: BPO) -> dict:
    return {
        "id": b.id, "case_id": b.case_id, "bpo_number": b.bpo_number, "control_number": b.control_number,
        "status": b.status.value if b.status else None,
        "relief_stop_physical_harm": b.relief_stop_physical_harm,
        "relief_stop_threats": b.relief_stop_threats,
        "relief_stay_away_100m": b.relief_stay_away_100m,
        "applied_at": b.applied_at, "issued_at": b.issued_at, "expires_at": b.expires_at,
        "served_at": b.served_at, "served_by": b.served_by, "proof_of_service": b.proof_of_service,
        "issued_by_official": b.issued_by_official, "created_at": b.created_at,
    }


# ── POST /admin/cases/{case_id}/bpo ───────────────────────────────────────────
@router.post("/cases/{case_id}/bpo")
def create_bpo(
    case_id: int,
    payload: BPOCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    case = db.query(Case).filter(Case.id == case_id, Case.is_deleted == False).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    # A new BPO requires a NEW act of violence. If an active (not expired /
    # superseded) BPO exists, refuse — a BPO cannot be extended or renewed.
    active = [b for b in case.bpos if b.status in (BPOStatus.applied, BPOStatus.issued, BPOStatus.served)]
    for b in active:
        if b.status != BPOStatus.applied and b.expires_at and b.expires_at > datetime.utcnow():
            raise HTTPException(
                status_code=409,
                detail=("This case already has an active BPO that has not expired. A BPO cannot be "
                        "extended or renewed; a new BPO requires a new act of violence. File a new "
                        "incident report first, then issue a new BPO."),
            )

    bpo = BPO(
        case_id=case.id,
        bpo_number=_bpo_number(db),
        control_number=payload.control_number,
        status=BPOStatus.applied,
        relief_stop_physical_harm=payload.relief_stop_physical_harm,
        relief_stop_threats=payload.relief_stop_threats,
        relief_stay_away_100m=payload.relief_stay_away_100m,
        applied_at=datetime.utcnow(),
    )
    db.add(bpo)
    case.status = ReportStatus.bpo_applied
    case.admin_id = current_admin.id
    case.has_status_update = True
    case.updated_at = datetime.utcnow()
    db.commit(); db.refresh(bpo)
    return {"message": "BPO application created.", "bpo": _serialize(bpo)}


# ── PATCH /admin/bpos/{bpo_id}/issue ──────────────────────────────────────────
@router.patch("/bpos/{bpo_id}/issue")
def issue_bpo(
    bpo_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    bpo = db.query(BPO).filter(BPO.id == bpo_id).first()
    if not bpo:
        raise HTTPException(status_code=404, detail="BPO not found.")
    if bpo.status != BPOStatus.applied:
        raise HTTPException(status_code=409, detail="Only an applied BPO can be issued.")

    now = datetime.utcnow()
    bpo.issued_at = now
    bpo.expires_at = now + timedelta(days=BPO_VALID_DAYS)   # never modified afterwards
    bpo.status = BPOStatus.issued
    bpo.issued_by_official = _active_official(db, OfficialRole.punong_barangay)

    case = db.query(Case).filter(Case.id == bpo.case_id).first()
    if case:
        case.status = ReportStatus.bpo_issued
        case.has_status_update = True
        case.updated_at = now
    db.commit(); db.refresh(bpo)
    return {"message": "BPO issued.", "bpo": _serialize(bpo)}


# ── PATCH /admin/bpos/{bpo_id}/serve ──────────────────────────────────────────
@router.patch("/bpos/{bpo_id}/serve")
def serve_bpo(
    bpo_id: int,
    payload: BPOServe,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    bpo = db.query(BPO).filter(BPO.id == bpo_id).first()
    if not bpo:
        raise HTTPException(status_code=404, detail="BPO not found.")
    if bpo.status not in (BPOStatus.issued, BPOStatus.served):
        raise HTTPException(status_code=409, detail="Only an issued BPO can be served.")

    when = datetime.utcnow()
    if payload.served_at:
        try:
            when = datetime.fromisoformat(payload.served_at.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            pass
    bpo.served_at = when
    bpo.served_by = payload.served_by
    bpo.proof_of_service = payload.proof_of_service
    bpo.status = BPOStatus.served

    case = db.query(Case).filter(Case.id == bpo.case_id).first()
    if case:
        case.status = ReportStatus.bpo_served
        case.has_status_update = True
        case.updated_at = datetime.utcnow()
    db.commit(); db.refresh(bpo)
    return {"message": "BPO served.", "bpo": _serialize(bpo)}


# ── PATCH /admin/bpos/{bpo_id}/revert ─────────────────────────────────────────
@router.patch("/bpos/{bpo_id}/revert")
def revert_bpo(
    bpo_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    """Step a BPO back one stage after an accidental click:
    served -> issued, issued -> applied (clears the issue/expiry record)."""
    bpo = db.query(BPO).filter(BPO.id == bpo_id).first()
    if not bpo:
        raise HTTPException(status_code=404, detail="BPO not found.")

    if bpo.status == BPOStatus.served:
        bpo.status = BPOStatus.issued
        bpo.served_at = None; bpo.served_by = None; bpo.proof_of_service = None
        moved_to = "issued"
    elif bpo.status == BPOStatus.issued:
        bpo.status = BPOStatus.applied
        bpo.issued_at = None; bpo.expires_at = None; bpo.issued_by_official = None
        moved_to = "applied"
    else:
        raise HTTPException(status_code=409, detail="Only an issued or served BPO can be reverted. Delete an application instead.")

    case = db.query(Case).filter(Case.id == bpo.case_id).first()
    if case:
        case.status = recompute_case_status(case)
        case.updated_at = datetime.utcnow()
    db.commit(); db.refresh(bpo)
    return {"message": f"BPO reverted to {moved_to}.", "bpo": _serialize(bpo)}


# ── DELETE /admin/bpos/{bpo_id} ───────────────────────────────────────────────
@router.delete("/bpos/{bpo_id}")
def delete_bpo(
    bpo_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    """Remove a BPO application created by mistake. Only an application that was
    never issued can be deleted — an issued BPO is an official record (revert it first)."""
    bpo = db.query(BPO).filter(BPO.id == bpo_id).first()
    if not bpo:
        raise HTTPException(status_code=404, detail="BPO not found.")
    if bpo.status != BPOStatus.applied:
        raise HTTPException(status_code=409, detail="Only a BPO application that has not been issued can be deleted. Revert it first.")
    case = db.query(Case).filter(Case.id == bpo.case_id).first()
    db.delete(bpo); db.flush()
    if case:
        db.refresh(case)
        case.status = recompute_case_status(case)
        case.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "BPO application deleted."}


# ── GET /admin/bpos/expiring ──────────────────────────────────────────────────
@router.get("/bpos/expiring")
def expiring_bpos(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    """Issued BPOs at or past day 12 of 15 (warning), and ones already expired."""
    now = datetime.utcnow()
    warn_before = now + timedelta(days=BPO_VALID_DAYS - EXPIRY_WARN_DAY)  # expires within 3 days
    issued = db.query(BPO).filter(BPO.status == BPOStatus.issued).all()
    out = []
    for b in issued:
        if not b.expires_at:
            continue
        days_left = (b.expires_at - now).days
        if b.expires_at <= now:
            # Auto-flip to expired (never an extend/renew).
            b.status = BPOStatus.expired
            out.append({**_serialize(b), "days_left": 0, "expired": True})
        elif b.expires_at <= warn_before:
            out.append({**_serialize(b), "days_left": days_left, "expired": False})
    db.commit()
    return {"expiring": out}
