from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import re

from database import get_db
from models.case import Case
from models.report import Report, ReportStatus
from models.user import User
from core.dependencies import get_current_user
from core.encryption import encrypt, encrypt_float, decrypt, decrypt_float

router = APIRouter(prefix="/cases", tags=["Cases"])

STATUS_DISPLAY = {
    "submitted":             "Submitted",
    "awaiting_onsite_visit": "Awaiting Onsite Visit",
    "under_process":         "Under Process",
    "summon_issued":         "Summon Letter Issued",
    "summon_acknowledged":   "Summon Acknowledged",
    "resolved":              "Resolved",
    "referred_to_police":    "Referred to Police",
}

# Statuses that are "closed" — no merging into these
CLOSED_STATUSES = {ReportStatus.resolved, ReportStatus.referred_to_police}


# ── Helpers ───────────────────────────────────────────────────────────────────
def _normalize(name: str) -> str:
    """Normalize offender name for fuzzy matching."""
    return re.sub(r'\s+', ' ', name.strip().lower())


def _fuzzy_match(a: str, b: str) -> bool:
    """Case-insensitive, whitespace-normalized match."""
    return _normalize(a) == _normalize(b)


def _generate_case_number(db: Session) -> str:
    """Generate next case number in format YYYY-000-NNN."""
    year = datetime.utcnow().year
    prefix = f"{year}-000-"
    # Count existing cases this year
    count = db.query(Case).filter(
        Case.case_number.like(f"{year}-%")
    ).count()
    return f"{prefix}{str(count + 1).zfill(3)}"


def _decrypt_report(r: Report) -> dict:
    return {
        "id":            r.id,
        "case_id":       r.case_id,
        "statement":     decrypt(r.statement),
        "photo_urls":    r.photo_urls or [],
        "address":       r.address,
        "latitude":      decrypt_float(r.latitude),
        "longitude":     decrypt_float(r.longitude),
        "incident_type": r.incident_type,
        "incident_date": r.incident_date,
        "is_read":       r.is_read,
        "created_at":    r.created_at,
        "updated_at":    r.updated_at,
    }


def _decrypt_case(c: Case, include_reports: bool = False) -> dict:
    raw_status = c.status.value if c.status else None
    data = {
        "id":                  c.id,
        "case_number":         c.case_number,
        "user_id":             c.user_id,
        "admin_id":            c.admin_id,
        "offender_name":       decrypt(c.offender_name),
        "status":              raw_status,
        "status_display":      STATUS_DISPLAY.get(raw_status, raw_status),
        "has_status_update":   c.has_status_update,
        "admin_message":       c.admin_message,
        "admin_message_at":    c.admin_message_at,
        "is_deleted":          c.is_deleted,
        "delete_reason":       c.delete_reason,
        "deleted_at":          c.deleted_at,
        "admin_recovered":     c.admin_recovered,
        "report_count":        len(c.reports),
        "created_at":          c.created_at,
        "updated_at":          c.updated_at,
    }
    if include_reports:
        data["reports"] = [_decrypt_report(r) for r in sorted(c.reports, key=lambda r: r.created_at, reverse=True)]
    return data


# ── Schemas ───────────────────────────────────────────────────────────────────
class ReportCreate(BaseModel):
    statement:     str
    offender_name: str
    incident_date: Optional[datetime]  = None
    incident_type: Optional[str]       = None
    photo_urls:    Optional[List[str]] = []
    latitude:      Optional[float]     = None
    longitude:     Optional[float]     = None
    address:       Optional[str]       = None
    force_new:     bool                = False  # victim chose to create new case


class DeleteRequest(BaseModel):
    reason: Optional[str] = None


# ── GET /cases/check-duplicate ────────────────────────────────────────────────
@router.get("/check-duplicate")
def check_duplicate(
    offender_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Called before submission to check if an open case exists
    with the same offender. Returns match info for the merge notice.
    """
    active_cases = db.query(Case).filter(
        Case.user_id   == current_user.id,
        Case.is_deleted == False,
        Case.status.notin_(list(CLOSED_STATUSES)),
    ).all()

    for c in active_cases:
        existing_name = decrypt(c.offender_name)
        if _fuzzy_match(existing_name, offender_name):
            return {
                "duplicate":   True,
                "case_number": c.case_number,
                "case_id":     c.id,
                "offender":    existing_name,
                "status":      STATUS_DISPLAY.get(c.status.value, c.status.value),
                "report_count": len(c.reports),
            }
    return {"duplicate": False}


# ── POST /cases/ — submit report (creates or merges) ──────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED)
def submit_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submits a new report/testimony.
    - If an open case exists with same offender → merges (adds as testimony)
    - If force_new=True → always creates a new case
    - Otherwise → creates a new case
    Returns: { merged, case_number, case_id, report_id }
    """
    if not payload.statement.strip():
        raise HTTPException(status_code=400, detail="Statement is required.")
    if not payload.offender_name.strip():
        raise HTTPException(status_code=400, detail="Offender name is required.")

    # Check for existing open case with same offender
    target_case = None
    if not payload.force_new:
        active_cases = db.query(Case).filter(
            Case.user_id    == current_user.id,
            Case.is_deleted == False,
            Case.status.notin_(list(CLOSED_STATUSES)),
        ).all()
        for c in active_cases:
            existing_name = decrypt(c.offender_name)
            if _fuzzy_match(existing_name, payload.offender_name):
                target_case = c
                break

    merged = False

    if target_case:
        # Merge — add testimony to existing case
        merged = True
    else:
        # Create new case
        case_number = _generate_case_number(db)
        target_case = Case(
            case_number   = case_number,
            user_id       = current_user.id,
            offender_name = encrypt(payload.offender_name),
            status        = ReportStatus.submitted,
        )
        db.add(target_case)
        db.flush()  # get ID without committing

    # Create the report/testimony
    report = Report(
        case_id       = target_case.id,
        statement     = encrypt(payload.statement),
        photo_urls    = payload.photo_urls or [],
        latitude      = encrypt_float(payload.latitude),
        longitude     = encrypt_float(payload.longitude),
        address       = payload.address,
        incident_type = payload.incident_type,
        incident_date = payload.incident_date,
    )
    db.add(report)

    # If merging, mark case as having a new update (admin notification)
    if merged:
        target_case.has_status_update = True
        target_case.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(report)

    return {
        "merged":      merged,
        "case_number": target_case.case_number,
        "case_id":     target_case.id,
        "report_id":   report.id,
        "message":     f"Report {'added to existing case' if merged else 'submitted as new case'} {target_case.case_number}.",
    }


# ── GET /cases/ — victim's cases ──────────────────────────────────────────────
@router.get("/")
def get_my_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cases = (
        db.query(Case)
        .filter(Case.user_id == current_user.id, Case.is_deleted == False)
        .order_by(desc(Case.updated_at))
        .all()
    )
    return [_decrypt_case(c) for c in cases]


# ── GET /cases/{case_id} — single case with reports ───────────────────────────
@router.get("/{case_id}")
def get_case_detail(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.query(Case).filter(
        Case.id      == case_id,
        Case.user_id == current_user.id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    return _decrypt_case(case, include_reports=True)


# ── POST /cases/{case_id}/mark-read ───────────────────────────────────────────
@router.post("/{case_id}/mark-read", status_code=status.HTTP_200_OK)
def mark_case_read(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.query(Case).filter(
        Case.id      == case_id,
        Case.user_id == current_user.id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    case.has_status_update = False
    db.commit()
    return {"detail": "Marked as read."}


# ── DELETE /cases/{case_id} — victim soft-deletes ─────────────────────────────
@router.delete("/{case_id}", status_code=status.HTTP_200_OK)
def delete_case(
    case_id: int,
    body: DeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    case = db.query(Case).filter(
        Case.id      == case_id,
        Case.user_id == current_user.id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    if case.is_deleted:
        raise HTTPException(status_code=400, detail="Case already deleted.")
    case.is_deleted    = True
    case.delete_reason = body.reason or "No reason provided"
    case.deleted_at    = datetime.utcnow()
    db.commit()
    return {"detail": "Case deleted."}


# ── DELETE /cases/{case_id}/reports/{report_id} — delete single testimony ─────
@router.delete("/{case_id}/reports/{report_id}", status_code=status.HTTP_200_OK)
def delete_report(
    case_id: int,
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify case belongs to user
    case = db.query(Case).filter(
        Case.id      == case_id,
        Case.user_id == current_user.id,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    report = db.query(Report).filter(
        Report.id      == report_id,
        Report.case_id == case_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    db.delete(report)
    db.commit()
    return {"detail": "Report deleted."}
