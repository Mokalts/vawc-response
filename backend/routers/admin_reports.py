from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from database import get_db
from models.report import Report, ReportStatus
from models.user import User
from models.admin import Admin
from core.admin_dependencies import get_current_admin_full_access
from core.encryption import decrypt, decrypt_float, encrypt
from core.masking import mask_report_dict, mask_phone, mask_email, mask_address, mask_last_initial
from typing import Optional, List
from datetime import datetime, timedelta

router = APIRouter(prefix="/admin/reports", tags=["Admin Reports"])

VALID_INCIDENT_TYPES = [
    "Physical Abuse", "Sexual Abuse", "Psychological Abuse",
    "Economic Abuse", "Other",
]

STATUS_DISPLAY = {
    "submitted":             "Submitted",
    "awaiting_onsite_visit": "Awaiting Onsite Visit",
    "summon_issued":         "Summon Letter Issued",
    "summon_acknowledged":   "Summon Acknowledged",
    "resolved":              "Resolved",
    "referred_to_police":    "Referred to Police",
}


# ── Schemas ───────────────────────────────────────────────────────
class DeletePayload(BaseModel):
    reason: Optional[str] = None

class StatusPayload(BaseModel):
    status: str

class IncidentTypePayload(BaseModel):
    incident_type: str


# ── Helpers ───────────────────────────────────────────────────────
def _full_name(user) -> str:
    first  = getattr(user, "first_name",  "") or ""
    middle = getattr(user, "middle_name", "") or ""
    last   = getattr(user, "last_name",   "") or ""
    parts  = [p for p in [first, middle, last] if p.strip()]
    return " ".join(parts) if parts else "—"


def _dob(user):
    return (
        getattr(user, "date_of_birth", None)
        or getattr(user, "birthdate",    None)
        or getattr(user, "birth_date",   None)
    )


def _serialize_report(r, *, is_super_admin: bool = False) -> dict:
    """Decrypt + apply masking based on requester role."""
    data = _decrypt_report(r)
    if is_super_admin:
        data["photo_count"] = len(data.get("photo_urls") or [])
        data["restricted"]  = False
        return data
    return mask_report_dict(data)


def _decrypt_report(r):
    handled_by_username = None
    if r.handled_by:
        handled_by_username = r.handled_by.username

    raw_status = r.status.value if r.status else None

    return {
        "id":                  r.id,
        "admin_id":            r.admin_id,
        "handled_by_username": handled_by_username,
        "status":              raw_status,
        "status_display":      STATUS_DISPLAY.get(raw_status, raw_status),
        "statement":           decrypt(r.statement),
        "offender_name":       decrypt(r.offender_name) if r.offender_name else None,
        "photo_urls":          r.photo_urls or [],
        "address":             r.address,
        "latitude":            decrypt_float(r.latitude),
        "longitude":           decrypt_float(r.longitude),
        "incident_type":       r.incident_type,
        "incident_date":       r.incident_date,
        "is_read":             getattr(r, "is_read", False),
        "has_status_update":   getattr(r, "has_status_update", False),
        "created_at":          r.created_at,
        "updated_at":          r.updated_at,
        "deleted_at":          r.deleted_at,
        "is_deleted":          r.is_deleted,
        "delete_reason":       getattr(r, "delete_reason", None),
        "admin_recovered":     getattr(r, "admin_recovered", False),
        "victim_name":         _full_name(r.user),
        "victim_contact":      getattr(r.user, "phone_number", None),
        "victim_email":        getattr(r.user, "email",        None),
        "victim": {
            "id":            r.user.id,
            "first_name":    getattr(r.user, "first_name",  None),
            "middle_name":   getattr(r.user, "middle_name", None),
            "last_name":     getattr(r.user, "last_name",   None),
            "full_name":     _full_name(r.user),
            "email":         getattr(r.user, "email",        None),
            "phone_number":  getattr(r.user, "phone_number", None),
            "address":       getattr(r.user, "address",      None),
            "date_of_birth": _dob(r.user),
            "sex":           getattr(r.user, "sex", None),
        },
    }


# ── GET /admin/reports/unread-count ──────────────────────────────
# MUST be before /{report_id}
@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    # Unread count = submitted reports (not yet confirmed by officer)
    count = db.query(Report).filter(
        Report.is_deleted == False,
        Report.status     == ReportStatus.submitted,
    ).count()
    return {"unread": count}


# ── GET /admin/reports/recent ─────────────────────────────────────
# MUST be before /{report_id}
@router.get("/recent")
def get_recent_reports(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    reports = (
        db.query(Report)
        .join(User, Report.user_id == User.id)
        .filter(Report.is_deleted == False)
        .order_by(desc(Report.created_at))
        .limit(limit)
        .all()
    )
    new_count = db.query(Report).filter(
        Report.is_deleted == False,
        Report.status     == ReportStatus.submitted,
    ).count()
    return {
        "new_count": new_count,
        "reports":   [_serialize_report(r, is_super_admin=current_admin.is_super_admin) for r in reports],
    }


# ── GET /admin/reports/deleted ────────────────────────────────────
# MUST be before /{report_id}
@router.get("/deleted")
def get_deleted_reports(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    cutoff  = datetime.utcnow() - timedelta(days=30)
    reports = (
        db.query(Report)
        .join(User, Report.user_id == User.id)
        .filter(Report.is_deleted == True, Report.deleted_at >= cutoff)
        .order_by(desc(Report.deleted_at))
        .all()
    )
    return [_serialize_report(r, is_super_admin=current_admin.is_super_admin) for r in reports]


# ── GET /admin/reports/victims ────────────────────────────────────
# MUST be before /{report_id}
@router.get("/victims")
def get_victim_list(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    """
    Returns victims who have at least one CONFIRMED report (not submitted).
    Submitted reports live in New Reports modal only.
    """
    query = (
        db.query(User)
        .join(Report, Report.user_id == User.id)
        .filter(
            Report.is_deleted == False,
            User.is_deleted   == False,
            Report.status     != ReportStatus.submitted,  # confirmed only
        )
        .distinct()
    )
    if search:
        query = query.filter(
            User.first_name.ilike(f"%{search}%") |
            User.last_name.ilike(f"%{search}%")  |
            User.email.ilike(f"%{search}%")
        )
    victims = query.order_by(User.last_name, User.first_name).all()
    is_super = current_admin.is_super_admin

    result = []
    for victim in victims:
        # Only count confirmed (non-submitted) reports
        active_reports = (
            db.query(Report)
            .filter(
                Report.user_id    == victim.id,
                Report.is_deleted == False,
                Report.status     != ReportStatus.submitted,
            )
            .order_by(desc(Report.created_at))
            .all()
        )
        if not active_reports:
            continue

        latest     = active_reports[0]
        raw_status = latest.status.value if latest.status else None
        full_name  = _full_name(victim)

        result.append({
            "user_id":               victim.id,
            "full_name":             full_name if is_super else mask_last_initial(full_name),
            "first_name":            victim.first_name,
            "middle_name":           victim.middle_name if is_super else None,
            "last_name":             victim.last_name if is_super else (victim.last_name[0] + "." if victim.last_name else None),
            "email":                 victim.email if is_super else mask_email(victim.email),
            "phone_number":          victim.phone_number if is_super else mask_phone(victim.phone_number),
            "address":               victim.address if is_super else mask_address(victim.address),
            "report_count":          len(active_reports),
            "unread_count":          0,  # unread badge is now for submitted only
            "latest_status":         raw_status,
            "latest_status_display": STATUS_DISPLAY.get(raw_status, raw_status),
            "latest_report_date":    latest.created_at,
            "restricted":            not is_super,
        })

    return result


# ── GET /admin/reports/victims/{user_id} ─────────────────────────
@router.get("/victims/{user_id}")
def get_victim_reports(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    """
    Returns case folder for a victim — only confirmed (non-submitted) reports.
    """
    victim = db.query(User).filter(User.id == user_id).first()
    if not victim:
        raise HTTPException(status_code=404, detail="Victim not found.")

    reports = (
        db.query(Report)
        .filter(
            Report.user_id    == user_id,
            Report.is_deleted == False,
            Report.status     != ReportStatus.submitted,  # confirmed only
        )
        .order_by(desc(Report.created_at))
        .all()
    )

    is_super  = current_admin.is_super_admin
    full_name = _full_name(victim)
    return {
        "victim": {
            "id":           victim.id,
            "full_name":    full_name if is_super else mask_last_initial(full_name),
            "first_name":   victim.first_name,
            "middle_name":  victim.middle_name if is_super else None,
            "last_name":    victim.last_name if is_super else (victim.last_name[0] + "." if victim.last_name else None),
            "email":        victim.email if is_super else mask_email(victim.email),
            "phone_number": victim.phone_number if is_super else mask_phone(victim.phone_number),
            "address":      victim.address if is_super else mask_address(victim.address),
            "birthdate":    _dob(victim) if is_super else None,
            "sex":          victim.sex,
        },
        "reports":    [_serialize_report(r, is_super_admin=is_super) for r in reports],
        "restricted": not is_super,
    }


# ── GET /admin/reports ────────────────────────────────────────────
@router.get("")
def get_all_reports(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort:   Optional[str] = Query("newest"),
    page:   int           = Query(1, ge=1),
    limit:  int           = Query(12, ge=1, le=100),
    db:     Session       = Depends(get_db),
    current_admin: Admin  = Depends(get_current_admin_full_access),
):
    query = db.query(Report).join(User, Report.user_id == User.id).filter(
        Report.is_deleted == False
    )

    if status:
        # Explicit status filter (used by New Reports modal: status=submitted)
        try:
            query = query.filter(Report.status == ReportStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    else:
        # No filter: exclude submitted — they belong in New Reports modal only
        query = query.filter(Report.status != ReportStatus.submitted)

    if search:
        query = query.filter(
            User.first_name.ilike(f"%{search}%") |
            User.last_name.ilike(f"%{search}%")  |
            Report.address.ilike(f"%{search}%")
        )
    query = query.order_by(
        Report.created_at if sort == "oldest" else desc(Report.created_at)
    )
    total   = query.count()
    reports = query.offset((page - 1) * limit).limit(limit).all()
    return {
        "total":   total,
        "page":    page,
        "limit":   limit,
        "reports": [_serialize_report(r, is_super_admin=current_admin.is_super_admin) for r in reports],
    }


# ── GET /admin/reports/{report_id} — marks as read ───────────────
@router.get("/{report_id}")
def get_report_detail(
    report_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    if not report.is_read:
        report.is_read = True
        db.commit()
    return _serialize_report(report, is_super_admin=current_admin.is_super_admin)


# ── PATCH /admin/reports/{report_id}/status ───────────────────────
@router.patch("/{report_id}/status")
def update_report_status(
    report_id: int,
    payload: StatusPayload,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    report = db.query(Report).filter(
        Report.id == report_id, Report.is_deleted == False
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    try:
        report.status = ReportStatus(payload.status)
    except ValueError:
        valid = [s.value for s in ReportStatus]
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid}")
    report.admin_id          = current_admin.id
    report.has_status_update = True
    db.commit()
    return {
        "message":        "Status updated.",
        "status":         report.status.value,
        "status_display": STATUS_DISPLAY.get(report.status.value, report.status.value),
    }


# ── PATCH /admin/reports/{report_id}/incident-type ───────────────
@router.patch("/{report_id}/incident-type")
def update_incident_type(
    report_id: int,
    payload: IncidentTypePayload,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    report = db.query(Report).filter(
        Report.id == report_id, Report.is_deleted == False
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    if payload.incident_type not in VALID_INCIDENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid incident type.")
    report.incident_type = payload.incident_type
    report.admin_id      = current_admin.id
    db.commit()
    return {"message": "Incident type updated.", "incident_type": report.incident_type}


# ── DELETE /admin/reports/{report_id} — soft delete ──────────────
@router.delete("/{report_id}")
def delete_report(
    report_id: int,
    payload: DeletePayload = DeletePayload(),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    report = db.query(Report).filter(
        Report.id == report_id, Report.is_deleted == False
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    report.is_deleted    = True
    report.delete_reason = payload.reason or "Deleted by admin"
    report.deleted_at    = datetime.utcnow()
    db.commit()
    return {"message": f"Report #{report_id} deleted. Recoverable within 30 days."}


# ── PATCH /admin/reports/{report_id}/recover ─────────────────────
@router.patch("/{report_id}/recover")
def recover_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    cutoff = datetime.utcnow() - timedelta(days=30)
    report = db.query(Report).filter(
        Report.id         == report_id,
        Report.is_deleted == True,
        Report.deleted_at >= cutoff,
    ).first()
    if not report:
        raise HTTPException(
            status_code=404, detail="Report not found or recovery period expired."
        )
    report.is_deleted    = False
    report.deleted_at    = None
    report.delete_reason = None
    db.commit()
    return {"message": f"Report #{report_id} recovered."}


# ── DELETE /admin/reports/cleanup/expired ────────────────────────
@router.delete("/cleanup/expired")
def cleanup_deleted_reports(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    cutoff  = datetime.utcnow() - timedelta(days=30)
    expired = db.query(Report).filter(
        Report.is_deleted == True, Report.deleted_at < cutoff
    ).all()
    count = len(expired)
    for r in expired:
        db.delete(r)
    db.commit()
    return {"message": f"Permanently deleted {count} expired report(s)."}
