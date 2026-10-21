from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.otp import OTP
from models.case import Case
from models.report import Report
from models.case_activity import CaseActivity
from models.user_activity import UserActivity, log_user_activity
from schemas.user import UserResponse, UserUpdate, PasswordChange
from core.dependencies import get_current_user, get_user_for_id_submission
from core.security import verify_password, hash_password
from core.account_notice import notify_account_change
from core.progressive_limiter import check_rate_limit, record_failure, record_success, login_keys
from utils.cloudinary_helper import upload_image, destroy_image
from utils.otp_helper import sms_enabled
from core.timeutil import utc_to_ph_local
import uuid
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/users", tags=["Users"])


class RecoverAccountPayload(BaseModel):
    email: str
    password: str


@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_my_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only fields that genuinely change are collected: saving a form without
    # touching anything should not send her a warning about nothing.
    changed = []
    for field, label in (
        ("first_name", "First name"), ("middle_name", "Middle name"),
        ("last_name", "Last name"), ("address", "Address"),
        ("birthdate", "Birthdate"), ("sex", "Sex"),
    ):
        value = getattr(payload, field, None)
        if value is not None and value != getattr(current_user, field):
            setattr(current_user, field, value)
            changed.append(label)

    if payload.phone_number is not None and payload.phone_number != current_user.phone_number:
        existing = db.query(User).filter(
            User.phone_number == payload.phone_number,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already in use.")
        current_user.phone_number = payload.phone_number
        changed.append("Phone number")

    db.commit()
    db.refresh(current_user)
    # Recorded only as the names of the fields that moved, never the values:
    # the trail should say she changed her address, not what her address is.
    if changed:
        log_user_activity(db, current_user.id, "profile_updated", ", ".join(changed))
        db.commit()
    notify_account_change(current_user, changed)
    return current_user


@router.patch("/me/password")
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
    current_user.password_hash = hash_password(payload.new_password)
    log_user_activity(db, current_user.id, "password_changed")
    db.commit()
    notify_account_change(current_user, ["Password"])
    return {"message": "Password updated successfully."}


@router.delete("/me")
def delete_my_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Soft delete only — reports are kept as evidence
    # OTPs cleaned up since they're temporary tokens
    db.query(OTP).filter(OTP.user_id == current_user.id).delete()

    # A photograph of her government ID must not outlive the account. It was
    # held only so an officer could check it, and once she has closed the
    # account there is nobody left to check it for. The verification decision
    # stays on the row; the picture goes. If she recovers the account she is
    # asked for an ID again, which costs her a minute and is the right trade
    # against keeping a picture of her ID indefinitely.
    if current_user.id_document:
        destroy_image(current_user.id_document)
        current_user.id_document = None
        if (current_user.id_status or "none") == "pending":
            current_user.id_status = "none"

    current_user.is_deleted = True
    current_user.deleted_at = datetime.utcnow()
    db.commit()

    # Worth a notice even though she asked for it: if somebody else deleted her
    # account, this is the only thing that tells her before the 30 days run out.
    notify_account_change(current_user, ["Account deleted, recoverable for 30 days"])
    return {"message": "Account deleted. You can recover it within 30 days by signing in."}


@router.post("/recover")
def recover_account(
    payload: RecoverAccountPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    """Public endpoint — recover a soft-deleted account from the sign-in page.

    This takes an email and a password and is open to anyone, which makes it a
    login in everything but name. It therefore carries the same two brakes as
    /auth/login, and for the same reason: without them it is the one unguarded
    place to guess a password, and guessing is how an abuser gets in.

    It also answers identically for an unknown email and a wrong password.
    Before, an unknown email returned 404 and a wrong password 401, which told
    anyone who asked whether a given woman had an account here. That is not an
    abstract leak for this app.
    """
    limit_key, ip_key = login_keys("recover", request, payload.email)
    for key in (limit_key, ip_key):
        check = check_rate_limit(key)
        if not check["allowed"]:
            raise HTTPException(status_code=429, detail=check["message"])

    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        record_failure(limit_key)
        record_failure(ip_key)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    record_success(limit_key)
    record_success(ip_key)

    if not getattr(user, "is_deleted", False):
        raise HTTPException(status_code=400, detail="This account is not deleted.")

    # Check 30-day window
    cutoff = datetime.utcnow() - timedelta(days=30)
    deleted_at = getattr(user, "deleted_at", None)
    if deleted_at and deleted_at < cutoff:
        raise HTTPException(
            status_code=410,
            detail="Recovery period has expired. This account has been permanently deleted."
        )

    # Restore
    user.is_deleted = False
    user.deleted_at = None
    db.commit()

    return {"message": "Account recovered successfully. You can now sign in."}


# ─── POST /users/me/id-document — send an ID for checking ─────────────────────
ID_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
ID_MAX_MB = 10


@router.post("/me/id-document")
async def submit_id_document(
    id_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_user_for_id_submission),
):
    """Send an ID so an officer can confirm the account is a real person.

    Reached from two places: the registration form, which asks for one, and a
    refused sign-in, for an account that has none or whose ID was rejected.

    Identification is a condition of holding an ACCOUNT, not of being helped.
    That distinction is the whole design and is worth keeping straight: a woman
    deciding whether to report is often on a borrowed phone with her documents
    in a house she has left, and the hotlines on the first screen reach the
    barangay, the PNP and the DSWD without any of this.

    The photograph is uploaded as an authenticated asset, so its Cloudinary URL
    is worth nothing on its own, and it is destroyed the moment an officer
    decides either way.
    """
    if current_user.id_status == "pending":
        raise HTTPException(status_code=409, detail="An ID is already waiting to be checked.")
    if current_user.id_status == "approved":
        raise HTTPException(status_code=409, detail="This account is already verified.")

    kind = (id_type or "").strip()
    if not kind:
        raise HTTPException(status_code=422, detail="Say which ID this is.")
    if file.content_type not in ID_ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WEBP or HEIC images are allowed.")

    file_bytes = await file.read()
    if len(file_bytes) > ID_MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"That image is too large. Maximum {ID_MAX_MB}MB.")

    public_id = upload_image(
        file_bytes,
        f"id_{current_user.id}_{uuid.uuid4().hex}",
        folder="vawc-response/ids",
    )

    current_user.id_document = public_id
    current_user.id_type = kind[:80]
    log_user_activity(db, current_user.id, "id_submitted", kind)
    current_user.id_status = "pending"
    current_user.id_submitted_at = datetime.utcnow()
    current_user.id_reject_reason = None
    db.commit()

    return {
        "message": "Sent. The barangay VAWC desk will check it.",
        "id_status": "pending",
        "id_type": current_user.id_type,
    }


# ── Notification preferences ─────────────────────────────────────────────────
class NotificationPrefs(BaseModel):
    notify_enabled:       Optional[bool] = None
    notify_email:         Optional[bool] = None
    notify_sms:           Optional[bool] = None
    notify_case_updates:  Optional[bool] = None
    notify_desk_messages: Optional[bool] = None


def _prefs_payload(user: User) -> dict:
    return {
        "notify_enabled":       user.notify_enabled,
        "notify_email":         user.notify_email,
        "notify_sms":           user.notify_sms,
        "notify_case_updates":  user.notify_case_updates,
        "notify_desk_messages": user.notify_desk_messages,
        # Whether the SERVER can send a text at all, which is a different
        # question from whether she wants one. The screen greys the SMS row
        # when this is false, so turning SMS_ENABLED on in the deployment is
        # all it takes to make that row live.
        "sms_available":        sms_enabled(),
    }


@router.get("/me/notifications")
def get_notification_prefs(current_user: User = Depends(get_current_user)):
    return _prefs_payload(current_user)


@router.patch("/me/notifications")
def update_notification_prefs(
    payload: NotificationPrefs,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Only the switchable kinds live here.

    Sign-in codes, password resets and account-changed alerts have no field on
    this model on purpose, so no request body can turn them off.
    """
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if value is not None:
            setattr(current_user, field, bool(value))
    # Asking for texts the server cannot send would leave her believing she is
    # covered by a channel that is switched off.
    if current_user.notify_sms and not sms_enabled():
        current_user.notify_sms = False
    # Read before the commit rather than refreshing after it. commit() expires
    # the instance, and the reload that follows needs the object to belong to
    # this session - which is an assumption about where the caller got it from
    # that this endpoint has no business making.
    answer = _prefs_payload(current_user)
    db.commit()
    return answer


# ── Activity ─────────────────────────────────────────────────────────────────
# What an officer did to her case, phrased for her rather than for the audit
# screen. Anything not in this map is skipped, so a new officer action cannot
# start appearing on her phone just because someone added it to the admin side.
_CASE_ACTION_TEXT = {
    "status_changed":       "The barangay updated your case status",
    "assistance_ended":     "The barangay closed your case",
    "case_reopened":        "The barangay reopened your case",
    "message_sent":         "The barangay sent you a message",
    "respondent_corrected": "The barangay corrected the respondent details",
}

_OWN_ACTION_TEXT = {
    "signed_in":         "Signed in",
    "signed_out":        "Signed out",
    "password_changed":  "Password changed",
    "profile_updated":   "Profile updated",
    "id_submitted":      "ID sent for checking",
    "report_filed":      "You filed a report",
    "account_recovered": "Account recovered",
}


@router.get("/me/activity")
def my_activity(
    limit: int = 60,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Her own trail, newest first.

    Three sources merged: what she did (user_activities), what the barangay did
    to her cases (case_activities), and the milestones that were already
    implied by timestamps on her account before either table existed. That
    third source is what stops this being empty for every woman who registered
    before it shipped.
    """
    limit = max(1, min(limit, 200))
    entries = []

    def add(when, kind, text, detail=None):
        if not when:
            return
        entries.append({
            "at":     utc_to_ph_local(when).isoformat(),
            "kind":   kind,
            "text":   text,
            "detail": detail,
        })

    for row in (db.query(UserActivity)
                  .filter(UserActivity.user_id == current_user.id)
                  .order_by(UserActivity.created_at.desc())
                  .limit(limit).all()):
        text = _OWN_ACTION_TEXT.get(row.action)
        if text:
            add(row.created_at, "you", text, row.detail)

    case_ids = [c.id for c in db.query(Case).filter(
        Case.user_id == current_user.id, Case.is_deleted == False).all()]
    if case_ids:
        numbers = {c.id: c.case_number for c in db.query(Case).filter(Case.id.in_(case_ids)).all()}
        for row in (db.query(CaseActivity)
                      .filter(CaseActivity.case_id.in_(case_ids))
                      .order_by(CaseActivity.created_at.desc())
                      .limit(limit).all()):
            text = _CASE_ACTION_TEXT.get(row.action)
            if text:
                add(row.created_at, "barangay", text, numbers.get(row.case_id))

    # ── Milestones already on record ────────────────────────────────────────
    add(current_user.created_at, "you", "Account created")
    add(current_user.id_submitted_at, "you", "ID sent for checking")
    if current_user.id_reviewed_at:
        add(current_user.id_reviewed_at, "barangay",
            "Your ID was approved" if current_user.id_status == "approved"
            else "Your ID was not accepted")
    if case_ids:
        for r in (db.query(Report)
                    .filter(Report.case_id.in_(case_ids), Report.is_deleted == False)
                    .order_by(Report.created_at.desc()).limit(limit).all()):
            add(r.created_at, "you", "You filed a report")

    # Two sources can describe one event - an ID submission is both a logged
    # action and a timestamp on the account - so those collapse. Only those.
    # Collapsing everything by minute would also swallow a second sign-in a
    # moment after the first, which on a log whose point is spotting a sign-in
    # she did not make is the one thing it must never hide.
    DOUBLE_SOURCED = {"ID sent for checking", "You filed a report"}
    seen, unique = set(), []
    for e in sorted(entries, key=lambda e: e["at"], reverse=True):
        if e["text"] in DOUBLE_SOURCED:
            key = (e["at"][:16], e["text"], e.get("detail"))
            if key in seen:
                continue
            seen.add(key)
        unique.append(e)

    return {"entries": unique[:limit], "count": len(unique[:limit])}
