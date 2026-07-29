from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_db
from models.user import User
from models.report import Report, ReportStatus
from schemas.report import ReportCreate, ReportResponse, ReportListItem
from core.dependencies import get_current_user
from core.encryption import encrypt, encrypt_float, decrypt, decrypt_float

router = APIRouter(prefix="/reports", tags=["Reports"])

STATUS_DISPLAY = {
    "submitted":             "Submitted",
    "awaiting_onsite_visit": "Awaiting Onsite Visit",
    "summon_issued":         "Summon Letter Issued",
    "summon_acknowledged":   "Summon Acknowledged",
    "resolved":              "Resolved",
    "referred_to_police":    "Referred to Police",
}


# ── Schemas ───────────────────────────────────────────────────────
class DeleteReportRequest(BaseModel):
    reason: Optional[str] = None


# ── POST /reports/ — submit a new report ─────────────────────────
@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def submit_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = Report(
        user_id       = current_user.id,
        statement     = encrypt(payload.statement),
        offender_name = encrypt(payload.offender_name) if payload.offender_name else None,
        photo_urls    = payload.photo_urls or [],
        latitude      = encrypt_float(payload.latitude),
        longitude     = encrypt_float(payload.longitude),
        address       = payload.address,
        incident_type = getattr(payload, "incident_type", None),
        incident_date = getattr(payload, "incident_date", None),
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Decrypt before returning
    report.statement     = decrypt(report.statement)
    report.offender_name = decrypt(report.offender_name) if report.offender_name else None
    report.latitude      = decrypt_float(report.latitude)
    report.longitude     = decrypt_float(report.longitude)
    return report


# ── GET /reports/ — list victim's non-deleted reports ────────────
@router.get("/", response_model=List[ReportListItem])
def get_my_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reports = (
        db.query(Report)
        .filter(
            Report.user_id    == current_user.id,
            Report.is_deleted == False,
        )
        .order_by(Report.created_at.desc())
        .all()
    )
    for r in reports:
        r.statement     = decrypt(r.statement)
        r.offender_name = decrypt(r.offender_name) if r.offender_name else None
        r.latitude      = decrypt_float(r.latitude)
        r.longitude     = decrypt_float(r.longitude)
        # Attach display label
        raw = r.status.value if r.status else None
        r.status_display = STATUS_DISPLAY.get(raw, raw)
    return reports


# ── GET /reports/{report_id} — single report detail ──────────────
@router.get("/{report_id}", response_model=ReportResponse)
def get_report_detail(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(
        Report.id      == report_id,
        Report.user_id == current_user.id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    report.statement     = decrypt(report.statement)
    report.offender_name = decrypt(report.offender_name) if report.offender_name else None
    report.latitude      = decrypt_float(report.latitude)
    report.longitude     = decrypt_float(report.longitude)
    raw = report.status.value if report.status else None
    report.status_display = STATUS_DISPLAY.get(raw, raw)
    return report


# ── POST /reports/{report_id}/mark-read/ — clear notification ────
@router.post("/{report_id}/mark-read/", status_code=status.HTTP_200_OK)
def mark_report_read(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(
        Report.id      == report_id,
        Report.user_id == current_user.id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    report.has_status_update = False
    db.commit()
    return {"detail": "Marked as read."}


# ── DELETE /reports/{report_id}/ — victim soft-deletes ───────────
@router.delete("/{report_id}/", status_code=status.HTTP_200_OK)
def delete_report(
    report_id: int,
    body: DeleteReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    if report.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this report.")
    if report.is_deleted:
        raise HTTPException(status_code=400, detail="Report already deleted.")
    report.is_deleted    = True
    report.delete_reason = body.reason or "No reason provided"
    report.deleted_at    = datetime.utcnow()
    db.commit()
    return {"detail": "Report deleted successfully."}
