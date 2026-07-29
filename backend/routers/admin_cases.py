from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from database import get_db
from models.case import Case
from models.report import Report, ReportStatus
from models.user import User
from models.admin import Admin
from core.admin_dependencies import get_current_admin_full_access, require_super_admin
from core.encryption import decrypt, decrypt_float
from core.masking import mask_case_dict, mark_unrestricted, mask_phone, mask_email, mask_address, mask_last_initial
from utils.otp_helper import send_sms
from typing import Optional
from datetime import datetime, timedelta
import threading

router = APIRouter(prefix="/admin/cases", tags=["Admin Cases"])

STATUS_DISPLAY = {
    "submitted":             "Submitted",
    "awaiting_onsite_visit": "Awaiting Onsite Visit",
    "under_process":         "Under Process",
    "summon_issued":         "Summon Letter Issued",
    "summon_acknowledged":   "Summon Acknowledged",
    "resolved":              "Resolved",
    "referred_to_police":    "Referred to Authorities",
}

STATUS_EMAIL_MSG = {
    "awaiting_onsite_visit": "The barangay VAWC officer will be scheduling an onsite visit to follow up on your case.",
    "under_process":         "Your case is now being processed by the barangay VAWC office following your visit.",
    "summon_issued":         "A summon letter has been issued to the respondent in your case.",
    "summon_acknowledged":   "The respondent has acknowledged the summon letter.",
    "resolved":              "Your case has been successfully resolved at the barangay level.",
    "referred_to_police":    "Your case has been referred to the appropriate authorities for further action.",
}

VALID_INCIDENT_TYPES = [
    "Physical Abuse", "Sexual Abuse", "Psychological Abuse",
    "Economic Abuse", "Other",
]


# ── Schemas ───────────────────────────────────────────────────────────────────
class StatusPayload(BaseModel):
    status: str

class DeletePayload(BaseModel):
    reason: Optional[str] = None

class IncidentTypePayload(BaseModel):
    incident_type: str
    report_id: int

class MessagePayload(BaseModel):
    message: str
    send_email: bool = True
    send_sms: bool = False


# ── Helpers ───────────────────────────────────────────────────────────────────
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
        "is_deleted":    getattr(r, "is_deleted", False),
        "deleted_at":    getattr(r, "deleted_at", None),
        "created_at":    r.created_at,
        "updated_at":    r.updated_at,
    }


def _serialize_case(c: Case, *, include_reports: bool = False, is_super_admin: bool = False) -> dict:
    """Decrypt + apply masking based on requester role."""
    data = _decrypt_case(c, include_reports=include_reports)
    if is_super_admin:
        return mark_unrestricted(data)
    return mask_case_dict(data)


def _decrypt_case(c: Case, include_reports: bool = False) -> dict:
    raw_status = c.status.value if c.status else None
    handled_by = c.handled_by.username if c.handled_by else None
    unread_reports = [r for r in c.reports if not r.is_read]

    data = {
        "id":                  c.id,
        "case_number":         c.case_number,
        "user_id":             c.user_id,
        "admin_id":            c.admin_id,
        "handled_by":          handled_by,
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
        "unread_count":        len(unread_reports),
        "created_at":          c.created_at,
        "updated_at":          c.updated_at,
        "victim_name":         _full_name(c.user),
        "victim_email":        getattr(c.user, "email", None),
        "victim_phone":        getattr(c.user, "phone_number", None),
        "victim": {
            "id":                   c.user.id,
            "full_name":            _full_name(c.user),
            "first_name":           getattr(c.user, "first_name",            None),
            "middle_name":          getattr(c.user, "middle_name",           None),
            "last_name":            getattr(c.user, "last_name",             None),
            "email":                getattr(c.user, "email",                 None),
            "phone_number":         getattr(c.user, "phone_number",          None),
            "address":              getattr(c.user, "address",               None),
            "date_of_birth":        _dob(c.user),
            "sex":                  getattr(c.user, "sex",                   None),
            "is_minor":             getattr(c.user, "is_minor",              False),
            "guardian_name":        getattr(c.user, "guardian_name",         None),
            "guardian_relationship":getattr(c.user, "guardian_relationship", None),
        },
    }
    if include_reports:
        # Include all reports (active + deleted) sorted oldest first
        data["reports"] = [
            _decrypt_report(r)
            for r in sorted(c.reports, key=lambda r: r.created_at, reverse=False)
        ]
    return data


def _send_status_email(victim_email: str, victim_name: str, case_number: str, status: str, status_display: str):
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from core.config import settings

        extra_msg = STATUS_EMAIL_MSG.get(status, "Your case status has been updated.")

        html = f"""
        <div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #EDADC2;">
          <div style="background:#8B3050;padding:28px 32px;">
            <h1 style="color:#fff;margin:0;font-size:20px;">VAWC-Response</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Barangay Palanginan, Iba, Zambales</p>
          </div>
          <div style="padding:28px 32px;">
            <p style="font-size:15px;color:#0F172A;margin:0 0 6px;">Hello, <strong>{victim_name}</strong></p>
            <p style="font-size:14px;color:#475569;margin:0 0 20px;">Your case status has been updated.</p>
            <div style="background:#FBF0F3;border-radius:10px;padding:16px 20px;border-left:4px solid #C96882;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.7px;">Case Number</p>
              <p style="margin:0 0 12px;font-size:16px;font-weight:800;color:#8B3050;font-family:monospace;">{case_number}</p>
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.7px;">New Status</p>
              <p style="margin:0;font-size:15px;font-weight:700;color:#0F172A;">{status_display}</p>
            </div>
            <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px;">{extra_msg}</p>
            <p style="font-size:13px;color:#94A3B8;margin:0;">You can view your case details by logging into the VAWC-Response victim portal.</p>
          </div>
          <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #EDADC2;">
            <p style="font-size:12px;color:#94A3B8;margin:0;">This message is confidential and intended only for {victim_name}. Do not share this email with anyone.</p>
          </div>
        </div>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[VAWC-Response] Case {case_number} — Status Updated: {status_display}"
        msg["From"]    = settings.GMAIL_USER
        msg["To"]      = victim_email
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)
            server.sendmail(settings.GMAIL_USER, victim_email, msg.as_string())

    except Exception as e:
        print(f"[Email] Failed to send status update email: {e}")


# ── GET /admin/cases/unread-count ─────────────────────────────────────────────
@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    count = db.query(Case).filter(
        Case.is_deleted == False,
        Case.status     == ReportStatus.submitted,
    ).count()

    # ── Multi-report burst detection ─────────────────────────────────────────
    # Active when 2+ DIFFERENT victims submitted reports in the last 5 minutes.
    # Report has no user_id directly — join through Case to get the victim.
    window_minutes = 5
    window_start = datetime.utcnow() - timedelta(minutes=window_minutes)
    recent = (
        db.query(Case.user_id, Report.created_at)
        .join(Report, Report.case_id == Case.id)
        .filter(
            Report.is_deleted == False,
            Report.created_at >= window_start,
            Case.is_deleted == False,
        )
        .all()
    )
    distinct_users = {r.user_id for r in recent}
    multi_active = len(distinct_users) >= 2
    newest_at = max((r.created_at for r in recent), default=None) if recent else None

    return {
        "unread": count,
        "multi_alert": {
            "active":         multi_active,
            "report_count":   len(recent),
            "distinct_users": len(distinct_users),
            "window_minutes": window_minutes,
            "newest_at":      newest_at.isoformat() if newest_at else None,
        },
    }


# ── GET /admin/cases/recent ───────────────────────────────────────────────────
@router.get("/recent")
def get_recent_cases(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    cases = (
        db.query(Case)
        .join(User, Case.user_id == User.id)
        .filter(Case.is_deleted == False)
        .order_by(desc(Case.updated_at))
        .limit(limit)
        .all()
    )
    new_count = db.query(Case).filter(
        Case.is_deleted == False,
        Case.status     == ReportStatus.submitted,
    ).count()
    return {
        "new_count": new_count,
        "cases":     [_serialize_case(c, is_super_admin=current_admin.is_super_admin) for c in cases],
    }


# ── GET /admin/cases/deleted ──────────────────────────────────────────────────
@router.get("/deleted")
def get_deleted_cases(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    cutoff = datetime.utcnow() - timedelta(days=30)
    cases  = (
        db.query(Case)
        .join(User, Case.user_id == User.id)
        .filter(Case.is_deleted == True, Case.deleted_at >= cutoff)
        .order_by(desc(Case.deleted_at))
        .all()
    )
    return [_serialize_case(c, is_super_admin=current_admin.is_super_admin) for c in cases]


# ── GET /admin/cases/victims ──────────────────────────────────────────────────
@router.get("/victims")
def get_victim_list(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    query = (
        db.query(User)
        .join(Case, Case.user_id == User.id)
        .filter(
            Case.is_deleted == False,
            User.is_deleted == False,
            Case.status     != ReportStatus.submitted,
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
        active_cases = (
            db.query(Case)
            .filter(
                Case.user_id    == victim.id,
                Case.is_deleted == False,
                Case.status     != ReportStatus.submitted,
            )
            .order_by(desc(Case.updated_at))
            .all()
        )
        if not active_cases:
            continue
        latest     = active_cases[0]
        raw_status = latest.status.value if latest.status else None
        full_name = _full_name(victim)
        result.append({
            "user_id":               victim.id,
            "full_name":             full_name if is_super else mask_last_initial(full_name),
            "first_name":            victim.first_name,
            "middle_name":           victim.middle_name if is_super else None,
            "last_name":             victim.last_name if is_super else (victim.last_name[0] + "." if victim.last_name else None),
            "email":                 victim.email if is_super else mask_email(victim.email),
            "phone_number":          victim.phone_number if is_super else mask_phone(victim.phone_number),
            "address":               victim.address if is_super else mask_address(victim.address),
            "case_count":            len(active_cases),
            "latest_status":         raw_status,
            "latest_status_display": STATUS_DISPLAY.get(raw_status, raw_status),
            "latest_case_date":      latest.updated_at,
            "restricted":            not is_super,
        })
    return result


# ── GET /admin/cases/victims/{user_id} ────────────────────────────────────────
@router.get("/victims/{user_id}")
def get_victim_cases(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    victim = db.query(User).filter(User.id == user_id).first()
    if not victim:
        raise HTTPException(status_code=404, detail="Victim not found.")

    cases = (
        db.query(Case)
        .filter(
            Case.user_id    == user_id,
            Case.is_deleted == False,
            Case.status     != ReportStatus.submitted,
        )
        .order_by(desc(Case.updated_at))
        .all()
    )
    is_super = current_admin.is_super_admin
    full_name = _full_name(victim)
    victim_payload = {
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
    }
    return {
        "victim":     victim_payload,
        "cases":      [_serialize_case(c, is_super_admin=is_super) for c in cases],
        "restricted": not is_super,
    }


# ── GET /admin/cases ──────────────────────────────────────────────────────────
@router.get("")
def get_all_cases(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort:   Optional[str] = Query("newest"),
    page:   int           = Query(1, ge=1),
    limit:  int           = Query(20, ge=1, le=100),
    db:     Session       = Depends(get_db),
    current_admin: Admin  = Depends(get_current_admin_full_access),
):
    query = db.query(Case).join(User, Case.user_id == User.id).filter(
        Case.is_deleted == False
    )
    if status:
        try:
            query = query.filter(Case.status == ReportStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
    else:
        query = query.filter(Case.status != ReportStatus.submitted)

    if search:
        query = query.filter(
            User.first_name.ilike(f"%{search}%") |
            User.last_name.ilike(f"%{search}%")  |
            Case.case_number.ilike(f"%{search}%")
        )
    query = query.order_by(
        Case.updated_at if sort == "oldest" else desc(Case.updated_at)
    )
    total = query.count()
    cases = query.offset((page - 1) * limit).limit(limit).all()
    return {
        "total":  total,
        "page":   page,
        "limit":  limit,
        "cases":  [_serialize_case(c, is_super_admin=current_admin.is_super_admin) for c in cases],
    }


# ── GET /admin/cases/{case_id} ────────────────────────────────────────────────
@router.get("/{case_id}")
def get_case_detail(
    case_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    for r in case.reports:
        if not r.is_read:
            r.is_read = True
    db.commit()

    return _serialize_case(case, include_reports=True, is_super_admin=current_admin.is_super_admin)


# ── PATCH /admin/cases/{case_id}/status ───────────────────────────────────────
@router.patch("/{case_id}/status")
def update_case_status(
    case_id: int,
    payload: StatusPayload,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    case = db.query(Case).filter(
        Case.id == case_id, Case.is_deleted == False
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    try:
        case.status = ReportStatus(payload.status)
    except ValueError:
        valid = [s.value for s in ReportStatus]
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid}")

    case.admin_id          = current_admin.id
    case.has_status_update = True
    case.updated_at        = datetime.utcnow()
    db.commit()

    victim       = case.user
    victim_email = getattr(victim, "email", None)
    victim_name  = _full_name(victim)
    new_status   = case.status.value
    status_disp  = STATUS_DISPLAY.get(new_status, new_status)
    case_number  = case.case_number

    if victim_email and new_status != "submitted":
        t = threading.Thread(
            target=_send_status_email,
            args=(victim_email, victim_name, case_number, new_status, status_disp),
            daemon=True,
        )
        t.start()

    return {
        "message":        "Status updated.",
        "status":         case.status.value,
        "status_display": STATUS_DISPLAY.get(case.status.value, case.status.value),
    }


# ── PATCH /admin/cases/{case_id}/reports/{report_id}/incident-type ────────────
@router.patch("/{case_id}/reports/{report_id}/incident-type")
def update_incident_type(
    case_id: int,
    report_id: int,
    payload: IncidentTypePayload,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    report = db.query(Report).filter(
        Report.id      == report_id,
        Report.case_id == case_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    if payload.incident_type not in VALID_INCIDENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid incident type.")
    report.incident_type = payload.incident_type
    db.commit()
    return {"message": "Incident type updated.", "incident_type": report.incident_type}


# ── Message / hearing-notice email ────────────────────────────────────────────
def _send_message_email(victim_email: str, victim_name: str, case_number: str, message: str):
    try:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from core.config import settings

        safe_msg = (message or "").replace("\n", "<br/>")
        html = f"""
        <div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #EDADC2;">
          <div style="background:#8B3050;padding:28px 32px;">
            <h1 style="color:#fff;margin:0;font-size:20px;">VAWC-Response</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Barangay Palanginan, Iba, Zambales</p>
          </div>
          <div style="padding:28px 32px;">
            <p style="font-size:15px;color:#0F172A;margin:0 0 6px;">Hello, <strong>{victim_name}</strong></p>
            <p style="font-size:14px;color:#475569;margin:0 0 20px;">You have a new message from the barangay VAWC office regarding your case.</p>
            <div style="background:#FBF0F3;border-radius:10px;padding:16px 20px;border-left:4px solid #C96882;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.7px;">Case Number</p>
              <p style="margin:0 0 12px;font-size:16px;font-weight:800;color:#8B3050;font-family:monospace;">{case_number}</p>
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.7px;">Message</p>
              <p style="margin:0;font-size:14px;color:#0F172A;line-height:1.6;">{safe_msg}</p>
            </div>
            <p style="font-size:13px;color:#94A3B8;margin:0;">Log in to the VAWC-Response victim portal to view your case.</p>
          </div>
          <div style="background:#F8FAFC;padding:16px 32px;border-top:1px solid #EDADC2;">
            <p style="font-size:12px;color:#94A3B8;margin:0;">This message is confidential and intended only for {victim_name}. Do not share it with anyone.</p>
          </div>
        </div>
        """
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[VAWC-Response] New message on Case {case_number}"
        msg["From"]    = settings.GMAIL_USER
        msg["To"]      = victim_email
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)
            server.sendmail(settings.GMAIL_USER, victim_email, msg.as_string())
    except Exception as e:
        print(f"[Email] Failed to send case message email: {e}")


# ── PATCH /admin/cases/{case_id}/message — Super Admin sends a message ─────────
@router.patch("/{case_id}/message")
def send_case_message(
    case_id: int,
    payload: MessagePayload,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    """Super Admin writes a free-text message (e.g. hearing schedule/venue) to the victim."""
    case = db.query(Case).filter(Case.id == case_id, Case.is_deleted == False).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    msg = (payload.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    case.admin_message     = msg
    case.admin_message_at  = datetime.utcnow()
    case.has_status_update = True  # surfaces the notification on the victim side
    case.updated_at        = datetime.utcnow()
    db.commit()

    victim = case.user
    victim_email = getattr(victim, "email", None)
    victim_phone = getattr(victim, "phone_number", None)
    sent = []

    if payload.send_email and victim_email:
        threading.Thread(
            target=_send_message_email,
            args=(victim_email, _full_name(victim), case.case_number, msg),
            daemon=True,
        ).start()
        sent.append("email")

    if payload.send_sms and victim_phone:
        sms_text = f"VAWC-Response (Case {case.case_number}): {msg}"
        threading.Thread(target=send_sms, args=(victim_phone, sms_text), daemon=True).start()
        sent.append("SMS")

    channels = " and ".join(sent) if sent else "no channel (saved only)"
    return {"message": f"Message saved and sent via {channels}.", "admin_message": msg}


# ── DELETE /admin/cases/{case_id}/message — Super Admin removes the message ────
@router.delete("/{case_id}/message")
def delete_case_message(
    case_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    case = db.query(Case).filter(Case.id == case_id, Case.is_deleted == False).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    case.admin_message    = None
    case.admin_message_at = None
    db.commit()
    return {"message": "Message deleted."}


# ── DELETE /admin/cases/{case_id} — soft delete ───────────────────────────────
@router.delete("/{case_id}")
def delete_case(
    case_id: int,
    payload: DeletePayload = DeletePayload(),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    case = db.query(Case).filter(
        Case.id == case_id, Case.is_deleted == False
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    case.is_deleted    = True
    case.delete_reason = payload.reason or "Deleted by admin"
    case.deleted_at    = datetime.utcnow()
    db.commit()
    return {"message": f"Case {case.case_number} deleted."}


# ── DELETE /admin/cases/{case_id}/force — permanent delete (Super Admin only) ─
@router.delete("/{case_id}/force")
def force_delete_case(
    case_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_super_admin),
):
    """
    Permanently remove a soft-deleted case and all its reports (cascade).
    Guarded so only cases already in 'Recently Deleted' can be purged, and only
    by a Super Admin. This is irreversible.
    """
    case = db.query(Case).filter(
        Case.id == case_id, Case.is_deleted == True
    ).first()
    if not case:
        raise HTTPException(
            status_code=404,
            detail="Deleted case not found. Only cases already in Recently Deleted can be permanently removed.",
        )
    case_number = case.case_number
    db.delete(case)  # cascades to reports via delete-orphan
    db.commit()
    return {"message": f"Case {case_number} permanently deleted."}


# ── DELETE /admin/cases/{case_id}/reports/{report_id} — soft delete ───────────
@router.delete("/{case_id}/reports/{report_id}")
def delete_report(
    case_id: int,
    report_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    # Must have at least 2 active reports to allow deletion
    active_reports = db.query(Report).filter(
        Report.case_id   == case_id,
        Report.is_deleted == False,
    ).count()
    if active_reports <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last remaining report in a case.")

    report = db.query(Report).filter(
        Report.id         == report_id,
        Report.case_id    == case_id,
        Report.is_deleted == False,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    report.is_deleted = True
    report.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": "Report soft-deleted. It can be recovered within 30 days."}


# ── PATCH /admin/cases/{case_id}/reports/{report_id}/recover ──────────────────
@router.patch("/{case_id}/reports/{report_id}/recover")
def recover_report(
    case_id: int,
    report_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    cutoff = datetime.utcnow() - timedelta(days=30)
    report = db.query(Report).filter(
        Report.id         == report_id,
        Report.case_id    == case_id,
        Report.is_deleted == True,
        Report.deleted_at >= cutoff,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found or recovery period has expired.")
    report.is_deleted = False
    report.deleted_at = None
    db.commit()
    return {"message": "Report recovered successfully."}


# ── PATCH /admin/cases/{case_id}/recover ──────────────────────────────────────
@router.patch("/{case_id}/recover")
def recover_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    cutoff = datetime.utcnow() - timedelta(days=30)
    case   = db.query(Case).filter(
        Case.id         == case_id,
        Case.is_deleted == True,
        Case.deleted_at >= cutoff,
    ).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or recovery expired.")
    case.is_deleted       = False
    case.deleted_at       = None
    case.delete_reason    = None
    case.admin_recovered  = True

    # If the case was deleted while still in 'submitted', promote it to
    # 'awaiting_onsite_visit' on recovery. Reasoning: a deleted-then-recovered
    # case has already been reviewed by an admin, so it shouldn't sit back
    # in the New Reports bucket (which would also keep the unread badge
    # incrementing). For any other status, preserve it.
    promoted = False
    if case.status == ReportStatus.submitted:
        case.status = ReportStatus.awaiting_onsite_visit
        case.admin_id = current_admin.id
        promoted = True

    db.commit()
    msg = (
        f"Case {case.case_number} recovered and moved to 'Awaiting Onsite Visit'."
        if promoted else
        f"Case {case.case_number} recovered."
    )
    return {"message": msg}
