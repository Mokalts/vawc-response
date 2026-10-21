from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import re

from database import get_db
from models.case import Case, RelationshipToOffender
from models.child import Child
from models.report import Report, ReportStatus
from models.user_activity import log_user_activity
from models.user import User
from core.dependencies import get_current_user
from core.encryption import encrypt, encrypt_float, decrypt, decrypt_float
from core.timeutil import ph_local_to_utc, utc_to_ph_local
from core.id_gate import require_verified_id

from core.status_labels import STATUS_DISPLAY

def photo_links(report):
    """Expiring links to a report's photographs.

    The stored value is a Cloudinary public id that only this server can turn
    into a real URL. What a browser gets is a link to our own /media endpoint
    carrying a token that names one image and dies in half an hour, so a link
    copied out of the page stops working.
    """
    from core.security import create_media_token
    return [
        f"/media/photo?t={create_media_token(f'report:{report.id}:{i}')}"
        for i, _ in enumerate(report.photo_urls or [])
    ]


router = APIRouter(prefix="/cases", tags=["Cases"])

# Statuses that are "closed" — no merging into these
CLOSED_STATUSES = {ReportStatus.endorsed, ReportStatus.closed}


# ── Helpers ───────────────────────────────────────────────────────────────────
def _normalize(name: str) -> str:
    """Normalize offender name for fuzzy matching."""
    return re.sub(r'\s+', ' ', name.strip().lower())


def _fuzzy_match(a: str, b: str) -> bool:
    """Case-insensitive, whitespace-normalized match."""
    return _normalize(a) == _normalize(b)


def _generate_case_number(db: Session) -> str:
    """Next case number in format YYYY-000-NNN.

    The year is Manila's, not the server's. Between midnight and 8am on the 1st
    of January, Manila is already in the new year while UTC is still in the old
    one, so a case filed at 2am on New Year's Day was numbered with the year
    that had just ended. case_number is unique and never reissued, so that is
    wrong on a document for as long as the document exists.

    Uses the HIGHEST existing sequence for the year, not a count: if any case is
    ever permanently deleted the count no longer matches the numbering and a
    count-based value collides with an existing case_number (unique), which
    surfaced as a 500 on submit.

    Still only as good as the moment it is read. Two reports submitted in the
    same instant both see the same highest number and both build the next one,
    and the unique index refuses the second. The caller retries; see below.
    """
    year = utc_to_ph_local(datetime.utcnow()).year
    prefix = f"{year}-000-"
    highest = 0
    for (cn,) in db.query(Case.case_number).filter(Case.case_number.like(f"{year}-%")).all():
        try:
            highest = max(highest, int(str(cn).rsplit("-", 1)[-1]))
        except (ValueError, TypeError):
            continue
    return f"{prefix}{str(highest + 1).zfill(3)}"


def _decrypt_report(r: Report) -> dict:
    return {
        "id":            r.id,
        "case_id":       r.case_id,
        "statement":     decrypt(r.statement),
        "photo_urls":    photo_links(r),
        "address":       decrypt(r.address),
        "latitude":      decrypt_float(r.latitude),
        "longitude":     decrypt_float(r.longitude),
        "incident_type": r.incident_type,
        "incident_date": r.incident_date,
        "is_read":       r.is_read,
        "created_at":    r.created_at,
        "updated_at":    r.updated_at,
    }



def _bpo_milestones(c: Case) -> dict | None:
    """The dates that matter to the person protected by the order, or None when
    no BPO was ever applied for."""
    bpos = list(getattr(c, "bpos", []) or [])
    if not bpos:
        return None
    latest = sorted(bpos, key=lambda b: b.applied_at or b.created_at)[-1]
    return {
        "applied_at": latest.applied_at,
        "issued_at":  latest.issued_at,
        "served_at":  latest.served_at,
        "expires_at": latest.expires_at,
        "status":     latest.status.value if latest.status else None,
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
        "messages": [
            {
                "id":         m.id,
                "message":    m.message,
                "created_at": m.created_at,
            }
            for m in sorted(c.messages, key=lambda x: x.created_at, reverse=True)
        ],
        "is_deleted":          c.is_deleted,
        "delete_reason":       c.delete_reason,
        "deleted_at":          c.deleted_at,
        "admin_recovered":     c.admin_recovered,
        "report_count":        len(c.reports),
        # Milestones of her own protection order. Without these the app could
        # only guess, and the timeline was showing "BPO Issued" and "BPO Served"
        # as completed on cases where no order was ever applied for.
        "bpo":                 _bpo_milestones(c),
        "created_at":          c.created_at,
        "updated_at":          c.updated_at,
    }
    if include_reports:
        data["reports"] = [_decrypt_report(r) for r in sorted(c.reports, key=lambda r: r.created_at, reverse=True)]
    return data


# ── Schemas ───────────────────────────────────────────────────────────────────
class ChildIn(BaseModel):
    name:           str
    date_of_birth:  Optional[str] = None
    sex:            Optional[str] = None
    under_her_care: bool          = False

class ReportCreate(BaseModel):
    statement:     str
    offender_name: str
    incident_date: Optional[datetime]  = None
    incident_type:  Optional[str]       = None          # legacy single (kept one release)
    incident_types: Optional[List[str]] = None          # RA 9262 forms (multi)
    relationship_to_offender: Optional[str] = None
    children:       Optional[List[ChildIn]] = None
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
    require_verified_id(current_user)

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
        # Relationship to offender (RA 9262 classification) — set on new case only.
        if payload.relationship_to_offender:
            try:
                target_case.relationship_to_offender = RelationshipToOffender(payload.relationship_to_offender)
            except ValueError:
                pass
        # Retried, because the number above is read before it is written and two
        # submissions in the same instant read the same one. The loser of that
        # race used to get a 500 on a report she had just spent several minutes
        # writing.
        #
        # The savepoint has to be opened BEFORE the add: rolling one back
        # removes the pending object from the session, so the next attempt adds
        # it again with a fresh number. Flushing inside a savepoint opened after
        # the add leaves the whole transaction unusable instead.
        for attempt in range(6):
            savepoint = db.begin_nested()
            try:
                db.add(target_case)
                db.flush()  # get ID without committing
                savepoint.commit()
                break
            except IntegrityError:
                savepoint.rollback()
                if attempt == 5:
                    raise HTTPException(
                        status_code=503,
                        detail="The desk is busy right now. Your draft is saved. Please tap Submit again.",
                    )
                target_case.case_number = _generate_case_number(db)

        # Optional children (BPO Application items 4/4a) — encrypted minor data.
        for ch in (payload.children or []):
            if ch.name and ch.name.strip():
                db.add(Child(
                    case_id=target_case.id,
                    name=encrypt(ch.name.strip()),
                    date_of_birth=encrypt(ch.date_of_birth) if ch.date_of_birth else None,
                    sex=ch.sex or None,
                    under_her_care=bool(ch.under_her_care),
                ))

    # Abuse forms: prefer the multi-select list; keep the legacy single populated.
    itypes = [t for t in (payload.incident_types or []) if t] or ([payload.incident_type] if payload.incident_type else [])
    # Create the report/testimony
    report = Report(
        case_id        = target_case.id,
        statement      = encrypt(payload.statement),
        photo_urls     = payload.photo_urls or [],
        latitude       = encrypt_float(payload.latitude),
        longitude      = encrypt_float(payload.longitude),
        address        = encrypt(payload.address) if payload.address else None,
        incident_types = itypes,
        incident_type  = (itypes[0] if itypes else None),
        # Her picker gives a naive local time; the column holds UTC like
        # everything else, so it is converted rather than stored as-is.
        incident_date  = ph_local_to_utc(payload.incident_date),
    )
    db.add(report)
    # The case number rather than anything she wrote: the activity screen is
    # a trail, not a second copy of her testimony.
    log_user_activity(db, current_user.id, "report_filed", target_case.case_number)

    # If merging, mark case as having a new update (admin notification)
    if merged:
        target_case.has_status_update = True
        target_case.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(report)

    _send_report_receipt(current_user, target_case.case_number)

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


def wants_report_receipt(user) -> bool:
    """Whether to email her a copy of a report she just filed.

    Pulled out of the sender so the decision can be read and tested on its
    own, without a thread or a mail server in the way. Defaults to False at
    every lookup - unlike the other preferences, which default to True - so an
    unmigrated database sends nothing rather than sending something she never
    asked for.
    """
    if user is None:
        return False
    if not getattr(user, "notify_report_receipt", False):
        return False
    if not getattr(user, "notify_enabled", True):
        return False
    return bool(getattr(user, "notify_email", True))


def _send_report_receipt(user, case_number: str):
    """Email her a copy of the record, if she asked for one.

    Every lookup defaults to False here rather than True: this is the one kind
    of mail where the safe failure is not sending. Sent on a thread so a slow
    mail server never holds up the submission, and swallowing its own errors
    so a bounced receipt can never fail the report it describes.
    """
    try:
        if not wants_report_receipt(user):
            return
        email = getattr(user, "email", None)
        if not email:
            return

        import html as _html
        import threading
        from utils.otp_helper import send_html_email
        from utils.email_templates import report_receipt_email
        from core.timeutil import utc_to_ph_local

        name = " ".join(p for p in [user.first_name, user.last_name] if p)
        filed_on = utc_to_ph_local(datetime.utcnow()).strftime("%d %B %Y, %I:%M %p")

        subject, body = report_receipt_email(
            _html.escape(name), _html.escape(case_number), filed_on
        )

        def _go():
            try:
                send_html_email(email, subject, body)
            except Exception as e:
                print(f"[Email] report receipt failed: {e}")

        threading.Thread(target=_go, daemon=True).start()
    except Exception as e:
        print(f"[Email] report receipt skipped: {e}")
