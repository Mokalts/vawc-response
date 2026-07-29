from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models.case import Case
from models.report import ReportStatus, Report
from models.user import User
from models.admin import Admin
from core.admin_dependencies import get_current_admin_full_access
from core.encryption import decrypt
from core.masking import mask_last_initial, mask_name
from datetime import datetime
import calendar

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])


def _resolve_range(period: str, start: str = None, end: str = None):
    """
    Resolve the reporting window.

    If explicit `start`/`end` (ISO dates) are given, use them (custom range).
    Otherwise compute a CALENDAR-ALIGNED window around today:
      monthly       -> current calendar month
      quarterly     -> current calendar quarter
      semi_annually -> current half of the year
      annually      -> current calendar year
    Returns (start_dt, end_dt, human_label).
    """
    if start and end:
        try:
            s = datetime.fromisoformat(start)
            e = datetime.fromisoformat(end)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start/end date format.")
        if e.hour == 0 and e.minute == 0 and e.second == 0:
            e = e.replace(hour=23, minute=59, second=59)
        if e < s:
            raise HTTPException(status_code=400, detail="End date cannot be before start date.")
        label = f"{s.strftime('%b %d, %Y')} — {e.strftime('%b %d, %Y')}"
        return s, e, label

    now = datetime.utcnow()
    y, m = now.year, now.month
    if period == "monthly":
        s = datetime(y, m, 1)
        e = datetime(y, m, calendar.monthrange(y, m)[1], 23, 59, 59)
        label = s.strftime("%B %Y")
    elif period == "semi_annually":
        if m <= 6:
            s, e, half = datetime(y, 1, 1), datetime(y, 6, 30, 23, 59, 59), "First"
        else:
            s, e, half = datetime(y, 7, 1), datetime(y, 12, 31, 23, 59, 59), "Second"
        label = f"{half} Half {y}"
    elif period == "annually":
        s, e = datetime(y, 1, 1), datetime(y, 12, 31, 23, 59, 59)
        label = f"Full Year {y}"
    else:  # quarterly (default)
        q_start = 3 * ((m - 1) // 3) + 1
        q_end   = q_start + 2
        s = datetime(y, q_start, 1)
        e = datetime(y, q_end, calendar.monthrange(y, q_end)[1], 23, 59, 59)
        label = f"Q{(m - 1) // 3 + 1} {y}"
    return s, e, label


STATUS_DISPLAY = {
    "submitted":             "Submitted",
    "awaiting_onsite_visit": "Awaiting Onsite Visit",
    "under_process":         "Under Process",
    "summon_issued":         "Summon Letter Issued",
    "summon_acknowledged":   "Summon Acknowledged",
    "resolved":              "Resolved",
    "referred_to_police":    "Referred to Police",
}

def _full_name(user) -> str:
    first  = getattr(user, "first_name",  "") or ""
    middle = getattr(user, "middle_name", "") or ""
    last   = getattr(user, "last_name",   "") or ""
    parts  = [p for p in [first, middle, last] if p.strip()]
    return " ".join(parts) if parts else "—"


@router.get("/dashboard")
def get_dashboard_stats(
    period: str = Query(default="quarterly"),
    start:  str = Query(default=None, description="Custom range start (ISO date)"),
    end:    str = Query(default=None, description="Custom range end (ISO date)"),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    start_dt, end_dt, period_label = _resolve_range(period, start, end)

    in_range = (
        Case.created_at >= start_dt,
        Case.created_at <= end_dt,
        Case.is_deleted == False,
    )

    total_cases = db.query(Case).filter(*in_range).count()

    status_counts = {}
    for status in ReportStatus:
        status_counts[status.value] = db.query(Case).filter(
            Case.status == status, *in_range
        ).count()

    pending  = status_counts.get("awaiting_onsite_visit", 0)
    resolved = status_counts.get("resolved", 0)
    new_cases = status_counts.get("submitted", 0)

    # ── Incident-type breakdown (reports within range, non-deleted) ──────────
    incident_rows = (
        db.query(Report.incident_type, func.count(Report.id))
        .join(Case, Report.case_id == Case.id)
        .filter(
            Report.is_deleted == False,
            Case.is_deleted == False,
            Report.created_at >= start_dt,
            Report.created_at <= end_dt,
        )
        .group_by(Report.incident_type)
        .all()
    )
    incident_types = [
        {"type": (t or "Unclassified"), "count": c}
        for t, c in incident_rows
    ]

    recent = (
        db.query(Case)
        .filter(*in_range)
        .order_by(Case.updated_at.desc())
        .limit(10)
        .all()
    )

    is_super = current_admin.is_super_admin
    recent_cases = []
    for c in recent:
        raw_status    = c.status.value if c.status else None
        victim_full   = _full_name(c.user) if c.user else "—"
        offender_full = decrypt(c.offender_name)
        recent_cases.append({
            "id":             c.id,
            "case_number":    c.case_number,
            "status":         raw_status,
            "status_display": STATUS_DISPLAY.get(raw_status, raw_status),
            "offender_name":  offender_full if is_super else mask_name(offender_full),
            "victim_name":    victim_full   if is_super else mask_last_initial(victim_full),
            "report_count":   len(c.reports),
            "created_at":     c.created_at,
            "updated_at":     c.updated_at,
            "restricted":     not is_super,
        })

    return {
        "total_reports":        total_cases,
        "total_victims":        db.query(User).filter(User.is_deleted == False).count(),
        "pending_confirmation": pending,
        "resolved":             resolved,
        "new_cases":            new_cases,
        "by_status":            status_counts,
        "incident_types":       incident_types,
        "recent_reports":       recent_cases,
        "period":               period,
        "period_label":         period_label,
        "start":                start_dt.date().isoformat(),
        "end":                  end_dt.date().isoformat(),
    }
