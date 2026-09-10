from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models.case import Case
from models.report import ReportStatus, Report
from models.user import User
from models.admin import Admin
from core.admin_dependencies import get_current_admin_full_access, require_super_admin
from core.encryption import decrypt
from core.masking import mask_last_initial, mask_name
from core.status_labels import CLOSURE_REASON_DISPLAY, RELATIONSHIP_DISPLAY, abuse_label
from datetime import datetime, timedelta
import calendar

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])


# ── GET /admin/monitoring ─────────────────────────────────────────────────────
# The measurable, legally-grounded metrics (spec Section 8).
@router.get("/monitoring")
def monitoring(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    cases = db.query(Case).filter(Case.is_deleted == False).all()
    FOURH = timedelta(hours=4)

    bpo = {"applied": 0, "issued": 0, "served": 0, "expired": 0, "superseded": 0}
    bpo_ever_issued = 0
    bpo_issued_same_day = 0
    endo_sent = endo_ack = 0
    pnp_reported = pnp_4h = mswdo_reported = mswdo_4h = 0
    by_abuse, by_rel, by_closure = {}, {}, {}

    for c in cases:
        # Mandatory reporting (4-hour clock)
        if c.reported_to_pnp_at:
            pnp_reported += 1
            if c.created_at and (c.reported_to_pnp_at - c.created_at) <= FOURH:
                pnp_4h += 1
        if c.reported_to_mswdo_at:
            mswdo_reported += 1
            if c.created_at and (c.reported_to_mswdo_at - c.created_at) <= FOURH:
                mswdo_4h += 1
        # Relationship
        if c.relationship_to_offender:
            k = c.relationship_to_offender.value
            by_rel[k] = by_rel.get(k, 0) + 1
        # Closure
        if c.status == ReportStatus.closed and c.closure_reason:
            k = c.closure_reason.value
            by_closure[k] = by_closure.get(k, 0) + 1
        # Abuse types (from reports). Canonicalise first: reports filed before
        # the lawful-flow rebuild stored title-case labels, so grouping on the
        # raw value splits one category across two buckets.
        for r in c.reports:
            types = (r.incident_types or ([r.incident_type] if r.incident_type else []))
            for t in types:
                label = abuse_label(t)
                if label:
                    by_abuse[label] = by_abuse.get(label, 0) + 1
        # BPOs
        for b in c.bpos:
            sv = b.status.value if b.status else None
            if sv in bpo:
                bpo[sv] += 1
            if b.issued_at:
                bpo_ever_issued += 1
                if b.applied_at and b.issued_at.date() == b.applied_at.date():
                    bpo_issued_same_day += 1
        # Endorsements
        for e in c.endorsements:
            endo_sent += 1
            if e.received_at:
                endo_ack += 1

    def pct(a, b):
        return round(100 * a / b) if b else 0

    return {
        "total_cases": len(cases),
        "bpo": {**bpo, "ever_issued": bpo_ever_issued,
                "issued_same_day": bpo_issued_same_day,
                "same_day_pct": pct(bpo_issued_same_day, bpo_ever_issued)},
        "mandatory_report": {
            "pnp_reported": pnp_reported, "pnp_within_4h": pnp_4h, "pnp_within_4h_pct": pct(pnp_4h, len(cases)),
            "mswdo_reported": mswdo_reported, "mswdo_within_4h": mswdo_4h, "mswdo_within_4h_pct": pct(mswdo_4h, len(cases)),
        },
        "endorsements": {"sent": endo_sent, "acknowledged": endo_ack, "outstanding": endo_sent - endo_ack},
        "by_abuse_type": by_abuse,
        "by_relationship": {RELATIONSHIP_DISPLAY.get(k, k): v for k, v in by_rel.items()},
        "closed_by_reason": {CLOSURE_REASON_DISPLAY.get(k, k): v for k, v in by_closure.items()},
    }


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


from core.status_labels import STATUS_DISPLAY

def _full_name(user) -> str:
    first  = getattr(user, "first_name",  "") or ""
    middle = getattr(user, "middle_name", "") or ""
    last   = getattr(user, "last_name",   "") or ""
    parts  = [p for p in [first, middle, last] if p.strip()]
    return " ".join(parts) if parts else "—"


@router.get("/monthly-report")
def monthly_report(
    year:  int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    """Rows for the Lupon Tagapamayapa Monthly Accomplishment Report.
    Super-admin only (returns full, unmasked complainant/respondent names)."""
    start = datetime(year, month, 1)
    end   = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

    cases = db.query(Case).filter(
        Case.is_deleted == False,
        Case.created_at >= start,
        Case.created_at <  end,
    ).order_by(Case.created_at.asc()).all()

    rows = []
    for c in cases:
        title = ""
        if c.reports:
            first_r = sorted(c.reports, key=lambda r: r.created_at)[0]
            # Display label, not the raw id — this prints on the Lupon monthly
            # accomplishment report, where "physical" would look like a bug.
            title = abuse_label(first_r.incident_type) or ""
        status_val = c.status.value if c.status else ""
        rows.append({
            "case_number": c.case_number,
            "date":        c.created_at.isoformat() if c.created_at else None,
            "complainant": _full_name(c.user),
            "respondent":  decrypt(c.offender_name),
            "title":       title,
            "remark":      STATUS_DISPLAY.get(status_val, status_val or ""),
        })

    return {"year": year, "month": month, "rows": rows}


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
    # Merge on the canonical label, not the raw column: legacy title-case values
    # ("Physical Abuse") and current ids ("physical") are the same category.
    _merged = {}
    for t, c in incident_rows:
        label = abuse_label(t) or "Unclassified"
        _merged[label] = _merged.get(label, 0) + c
    incident_types = [
        {"type": label, "count": count}
        for label, count in sorted(_merged.items(), key=lambda kv: -kv[1])
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
