"""
Super-admin user management endpoints.

All routes here are gated by `require_super_admin` and let a Super Admin:
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
from core.admin_dependencies import require_super_admin
from core.security import hash_password
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
    }


# ─── GET /admin/users — list active verified victims ───────────────────────
@router.get("")
def list_victims(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: Admin = Depends(require_super_admin),
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
    _: Admin = Depends(require_super_admin),
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
    _: Admin = Depends(require_super_admin),
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
@router.get("/{user_id}")
def get_victim(
    user_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_super_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    return _serialize(u)


# ─── PATCH /admin/users/{user_id} — edit victim profile ────────────────────
@router.patch("/{user_id}")
def update_victim(
    user_id: int,
    payload: VictimUpdate,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_super_admin),
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

    for k, v in data.items():
        setattr(u, k, v)
    db.commit()
    db.refresh(u)
    return _serialize(u)


# ─── PATCH /admin/users/{user_id}/reset-password ───────────────────────────
@router.patch("/{user_id}/reset-password")
def reset_victim_password(
    user_id: int,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_super_admin),
):
    u = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    validate_password_strength(payload.new_password)
    u.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": f"Password reset for {u.first_name} {u.last_name}. Please share the new password with them securely (in person or by phone)."}


# ─── PATCH /admin/users/{user_id}/archive — soft-delete the account ────────
@router.patch("/{user_id}/archive")
def archive_victim(
    user_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_super_admin),
):
    u = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found.")
    u.is_deleted = True
    u.deleted_at = datetime.utcnow()
    db.commit()
    return {"message": f"{u.first_name} {u.last_name}'s account archived. Recoverable for 30 days."}


# ─── PATCH /admin/users/{user_id}/recover — un-soft-delete ─────────────────
@router.patch("/{user_id}/recover")
def recover_victim(
    user_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_super_admin),
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
    return {"message": f"{u.first_name} {u.last_name}'s account recovered successfully."}


# ─── DELETE /admin/users/{user_id}/force — permanent delete (Super Admin) ──
@router.delete("/{user_id}/force")
def force_delete_victim(
    user_id: int,
    db: Session = Depends(get_db),
    _: Admin = Depends(require_super_admin),
):
    """
    TEMPORARY: permanently remove an archived (soft-deleted) victim account and
    ALL related data (cases -> reports, and OTPs). Guarded so only accounts
    already in the Deleted Victims list can be purged. This is irreversible.
    """
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
    _: Admin = Depends(require_super_admin),
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
