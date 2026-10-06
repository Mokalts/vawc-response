"""
Victim account management endpoints.

Open to any signed-in, face-verified admin. Every account here belongs to a VAW
Desk officer who handles these records as part of the job; creating and removing
ADMIN accounts stays with the Super Admin. These routes let an officer:
  - List verified victims, unverified accounts, and recently-deleted victims
  - Edit a victim's profile fields on their behalf
  - Reset a victim's password (the victim will see the new password when
    the Super Admin shares it offline — typically by phone or in person)
  - Archive (soft-delete) a victim account
  - Recover a soft-deleted account within the 30-day window
  - Permanently purge unverified accounts older than 90 days
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta

from database import get_db
from models.user import User
from models.admin import Admin
from models.case import Case
from models.otp import OTP
from core.admin_dependencies import get_current_admin_full_access
from utils.cloudinary_helper import destroy_image
from core.account_notice import notify_account_change
from core.config import settings
from core.security import hash_password, create_media_token
from routers.admin_auth import validate_password_strength

router = APIRouter(prefix="/admin/users", tags=["Admin Users"])


# ─── Schemas ───────────────────────────────────────────────────────────────
class VictimUpdate(BaseModel):
    first_name:            Optional[str] = None
    middle_name:           Optional[str] = None
    last_name:             Optional[str] = None
    email:                 Optional[EmailStr] = None
    phone_number:          Optional[str] = None
    address:               Optional[str] = None
    sex:                   Optional[str] = None
    is_minor:              Optional[bool] = None
    guardian_name:         Optional[str] = None
    guardian_relationship: Optional[str] = None


class PasswordReset(BaseModel):
    new_password: str


# ─── Helper ────────────────────────────────────────────────────────────────
def _serialize(u: User) -> dict:
    return {
        "id":                    u.id,
        "first_name":            u.first_name,
        "middle_name":           u.middle_name,
        "last_name":             u.last_name,
        "full_name":             u.full_name,
        "email":                 u.email,
        "phone_number":          u.phone_number,
        "birthdate":             u.birthdate.isoformat() if u.birthdate else None,
        "sex":                   u.sex,
        "address":               u.address,
        "is_verified":           u.is_verified,
        "is_minor":              u.is_minor,
        "guardian_name":         u.guardian_name,
        "guardian_relationship": u.guardian_relationship,
        "is_deleted":            u.is_deleted,
        "deleted_at":            u.deleted_at.isoformat() if u.deleted_at else None,
        "created_at":            u.created_at.isoformat() if u.created_at else None,
        "updated_at":            u.updated_at.isoformat() if u.updated_at else None,

        "id_status":             u.id_status or "none",
        "id_type":               u.id_type,
        "id_submitted_at":       u.id_submitted_at.isoformat() if u.id_submitted_at else None,
        "id_reviewed_at":        u.id_reviewed_at.isoformat() if u.id_reviewed_at else None,
        "id_reviewed_by":        u.id_reviewed_by,
        "id_reject_reason":      u.id_reject_reason,
        # Only exists while a decision is pending: the photograph is destroyed
        # once an officer has decided, so there is nothing left to link to.
        "id_document_url":       (
            f"/media/photo?t={create_media_token(f'id:{u.id}')}" if u.id_document else None
        ),
    }


# ─── GET /admin/users — list active verified victims ───────────────────────
@router.get("")
def list_victims(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    q = db.query(User).filter(
        User.is_deleted   == False,
        User.is_verified  == True,
    )
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(
            (User.first_name.ilike(s)) |
            (User.last_name.ilike(s))  |
            (User.email.ilike(s))      |
            (User.phone_number.ilike(s))
        )
    users = q.order_by(User.last_name, User.first_name).limit(500).all()
    return [_serialize(u) for u in users]


# ─── GET /admin/users/unverified — list dummy / never-verified accounts ────
@router.get("/unverified")
def list_unverified(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    users = (
        db.query(User)
        .filter(User.is_verified == False, User.is_deleted == False)
        .order_by(desc(User.created_at))
        .all()
    )
    return [_serialize(u) for u in users]


# ─── GET /admin/users/deleted — list recently soft-deleted victims ─────────
@router.get("/deleted")
def list_deleted_victims(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    cutoff = datetime.utcnow() - timedelta(days=30)
    users = (
        db.query(User)
        .filter(User.is_deleted == True, User.deleted_at >= cutoff)
        .order_by(desc(User.deleted_at))
        .all()
    )
    return [_serialize(u) for u in users]


# ─── GET /admin/users/{user_id} — single victim full profile ───────────────
# ─── GET /admin/users/id-pending — accounts waiting on an ID decision ──────
@router.get("/id-pending")
def list_id_pending(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    """The review queue. Oldest first: somebody who uploaded days ago should not
    sit behind somebody who uploaded this morning."""
    rows = (
        db.query(User)
        .filter(User.id_status == "pending", User.is_deleted == False)
        .order_by(User.id_submitted_at.asc())
        .all()
    )
    return {"count": len(rows), "users": [_serialize(u) for u in rows]}


# Declared BEFORE /{user_id}: FastAPI matches routes in order, and a literal
# path registered after a parameterised one is never reached.
@router.get("/{user_id}")
def get_victim(
    user_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    return _serialize(u)


# ─── PATCH /admin/users/{user_id} — edit victim profile ────────────────────
# Field names as the person would recognise them. Values are never put in the
# notice, only which field moved.
_FIELD_LABELS = {
    "first_name": "First name", "middle_name": "Middle name", "last_name": "Last name",
    "email": "Email address", "phone_number": "Phone number", "birthdate": "Birthdate",
    "sex": "Sex", "address": "Address", "is_minor": "Minor status",
    "guardian_name": "Guardian name", "guardian_relationship": "Guardian relationship",
}

@router.patch("/{user_id}")
def update_victim(
    user_id: int,
    payload: VictimUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    u = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")

    data = payload.dict(exclude_unset=True)

    # Uniqueness checks
    if "email" in data and data["email"] and data["email"] != u.email:
        if db.query(User).filter(User.email == data["email"], User.id != user_id).first():
            raise HTTPException(status_code=400, detail="Email already in use by another account.")
    if "phone_number" in data and data["phone_number"] and data["phone_number"] != u.phone_number:
        if db.query(User).filter(User.phone_number == data["phone_number"], User.id != user_id).first():
            raise HTTPException(status_code=400, detail="Phone number already in use by another account.")

    # Guardian fields auto-clear if is_minor flipped to False
    if data.get("is_minor") is False:
        data["guardian_name"] = None
        data["guardian_relationship"] = None

    # An email change has to reach the OLD address as well, or the one person
    # who needs the warning is the one who stops receiving it.
    old_email = u.email
    changed = [
        _FIELD_LABELS.get(k, k.replace("_", " ").capitalize())
        for k, v in data.items() if v != getattr(u, k, None)
    ]

    for k, v in data.items():
        setattr(u, k, v)
    db.commit()
    db.refresh(u)

    notify_account_change(
        u, changed, by_officer=True,
        also_email=old_email if old_email != u.email else None,
    )
    return _serialize(u)


# ─── PATCH /admin/users/{user_id}/reset-password ───────────────────────────
@router.patch("/{user_id}/reset-password")
def reset_victim_password(
    user_id: int,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    u = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    validate_password_strength(payload.new_password)
    u.password_hash = hash_password(payload.new_password)
    db.commit()
    notify_account_change(u, ["Password"], by_officer=True)
    return {"message": f"Password reset for {u.first_name} {u.last_name}. Please share the new password with them securely (in person or by phone)."}


# ─── PATCH /admin/users/{user_id}/archive — soft-delete the account ────────
@router.patch("/{user_id}/archive")
def archive_victim(
    user_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    u = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    u.is_deleted = True
    u.deleted_at = datetime.utcnow()
    db.commit()
    notify_account_change(u, ["Account archived, recoverable for 30 days"], by_officer=True)
    return {"message": f"{u.first_name} {u.last_name}'s account archived. Recoverable for 30 days."}


# ─── PATCH /admin/users/{user_id}/recover — un-soft-delete ─────────────────
@router.patch("/{user_id}/recover")
def recover_victim(
    user_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    cutoff = datetime.utcnow() - timedelta(days=30)
    u = db.query(User).filter(
        User.id == user_id,
        User.is_deleted == True,
        User.deleted_at >= cutoff,
    ).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found or recovery window expired (30 days).")
    u.is_deleted = False
    u.deleted_at = None
    db.commit()
    notify_account_change(u, ["Account restored"], by_officer=True)
    return {"message": f"{u.first_name} {u.last_name}'s account recovered successfully."}


# ─── DELETE /admin/users/{user_id}/force — permanent delete (Super Admin) ──
@router.delete("/{user_id}/force")
def force_delete_victim(
    user_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    """
    Permanently remove an archived (soft-deleted) victim account and ALL related
    data (cases -> reports, and OTPs). Guarded so only accounts already in the
    Deleted Victims list can be purged. This is irreversible.

    Off unless ALLOW_HARD_DELETE is set: during the pilot a mis-click here wipes
    a woman's account and every report she ever filed, with no recovery.
    """
    if not settings.ALLOW_HARD_DELETE:
        raise HTTPException(
            status_code=403,
            detail="Permanent deletion is disabled. Accounts stay in Deleted Victims.",
        )

    u = db.query(User).filter(User.id == user_id, User.is_deleted == True).first()
    if not u:
        raise HTTPException(
            status_code=404,
            detail="Deleted account not found. Only archived accounts (Deleted Victims) can be permanently removed.",
        )
    name = f"{u.first_name} {u.last_name}"

    # remove related records first to satisfy foreign keys
    for c in db.query(Case).filter(Case.user_id == user_id).all():
        db.delete(c)  # cascades to reports (delete-orphan)
    db.query(OTP).filter(OTP.user_id == user_id).delete()
    db.delete(u)
    db.commit()
    return {"message": f"{name}'s account and all related data permanently deleted."}


# ─── DELETE /admin/users/cleanup-unverified — purge dummy accounts > 90d ───
@router.delete("/cleanup-unverified")
def cleanup_unverified(
    db: Session = Depends(get_db),
    _: Admin = Depends(get_current_admin_full_access),
):
    cutoff = datetime.utcnow() - timedelta(days=90)
    expired = (
        db.query(User)
        .filter(User.is_verified == False, User.created_at < cutoff)
        .all()
    )
    count = len(expired)
    for u in expired:
        db.delete(u)
    db.commit()
    return {"message": f"Permanently deleted {count} unverified account(s) older than 90 days."}


class IdReview(BaseModel):
    approve: bool
    reason: Optional[str] = None


# ─── PATCH /admin/users/{user_id}/id-review — approve or reject an ID ──────
@router.patch("/{user_id}/id-review")
def review_id(
    user_id: int,
    payload: IdReview,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    """Decide on an uploaded ID, then destroy the photograph.

    The decision is the record worth keeping. Holding a photograph of a
    government ID, carrying her face, birthdate, address and signature, after it
    has served its purpose is a liability and nothing else: it cannot be leaked
    if it is not there. That is data minimisation under RA 10173, and it is the
    answer to "what do you do with the IDs you collect".

    The image is destroyed whichever way the decision goes. A rejected ID is not
    evidence of anything; she is told why and can upload again.
    """
    u = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    if u.id_status != "pending":
        raise HTTPException(status_code=409, detail="There is no ID waiting for a decision on this account.")

    reason = (payload.reason or "").strip()
    if not payload.approve and not reason:
        raise HTTPException(status_code=422, detail="Give a reason so she knows what to send instead.")

    u.id_status = "approved" if payload.approve else "rejected"
    u.id_reject_reason = None if payload.approve else reason[:300]
    u.id_reviewed_at = datetime.utcnow()
    u.id_reviewed_by = current_admin.full_name

    # Destroy first, clear second: if the delete fails we still stop pointing at
    # the asset, and the failure is logged rather than silently leaving an image
    # the record says was removed.
    destroy_image(u.id_document)
    u.id_document = None

    db.commit()

    notify_account_change(
        u,
        ["ID verification approved" if payload.approve else "ID verification rejected"],
        by_officer=True,
    )
    return {
        "message": "ID approved." if payload.approve else "ID rejected.",
        "id_status": u.id_status,
        "id_reject_reason": u.id_reject_reason,
    }
