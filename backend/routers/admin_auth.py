from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import get_db
from models.admin import Admin
from schemas.admin import AdminCreate, AdminLogin, AdminFaceEnroll, AdminFaceVerify, AdminResponse, AdminTokenResponse
from core.security import hash_password, verify_password, create_access_token
from core.admin_dependencies import (
    get_current_admin, get_current_admin_full_access, require_super_admin,
)
from core.config import settings
from core.progressive_limiter import (
    check_rate_limit, record_failure, record_success, login_keys, client_ip,
    IP_LOCKOUT_SCHEDULE,
)
from slowapi import Limiter
from pydantic import BaseModel
import numpy as np
import re
import secrets


router = APIRouter(prefix="/admin/auth", tags=["Admin Auth"])
# Keyed on the caller's own address, not slowapi's get_remote_address. That
# returns request.client.host, which behind Render's proxy is the proxy itself
# and therefore identical for every user on the internet: "12 registrations an
# hour" then meant twelve for the whole barangay, and one tester's signups
# locked out the next person in the queue. client_ip reads the forwarded address
# the way the login lockout already did.
limiter = Limiter(key_func=client_ip)

# Euclidean distance between 128-d face descriptors (face-api.js).
# Lower = stricter.
#
# This was 0.58. Same-person pairs typically land around 0.3–0.5 and
# different-person pairs around 0.5–0.9, so 0.58 sat inside the overlap and let
# another person's face through. 0.45 keeps the honest attempts and cuts most of
# the overlap; a rejected admin can retry or have their face reset, whereas a
# false acceptance hands over victim records.
FACE_MATCH_THRESHOLD = settings.FACE_MATCH_THRESHOLD

# A second, relative test: the presented face must be closer to the account it
# claims than to any other enrolled admin. Absolute distance alone cannot tell
# "this is Ana" from "this is nobody in particular, but within range".
NEAREST_MARGIN = 0.04


def compute_face_distance(descriptor1: list, descriptor2: list) -> float:
    a = np.array(descriptor1)
    b = np.array(descriptor2)
    return float(np.linalg.norm(a - b))


def set_auth_cookie(response: Response, token: str):
    from core.config import settings
    response.set_cookie(
        key="admin_token",
        value=token,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,   # "none" for cross-site prod, "lax" local
        secure=settings.COOKIE_SECURE,        # True required when SameSite=None (HTTPS)
        max_age=60 * 60 * 8, # 8 hours
    )


# ─── Password validator ───────────────────────────────────────────────────────

def validate_password_strength(password: str):
    """Raises HTTPException 400 if password does not meet requirements."""
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must include at least one uppercase letter.")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail="Password must include at least one number.")
    if not re.search(r"[!@#$%^&*()\,.\?\":{}|<>_\-]", password):
        raise HTTPException(status_code=400, detail="Password must include at least one special character.")


# ---------------------------------------------------------------------------
# Super Admin: Create Admin Account
# ---------------------------------------------------------------------------
@router.post("/create-account", response_model=AdminResponse)
def create_admin_account(
    payload: AdminCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    validate_password_strength(payload.password)

    if db.query(Admin).filter(Admin.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already in use.")
    if db.query(Admin).filter(Admin.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already in use.")
    if db.query(Admin).filter(Admin.phone_number == payload.phone_number).first():
        raise HTTPException(status_code=400, detail="Phone number already in use.")
    if payload.position not in ["Admin"]:
        raise HTTPException(status_code=400, detail="Position must be 'Admin'.")

    existing_ids = [
        a.employee_id for a in db.query(Admin.employee_id).all()
        if a.employee_id and a.employee_id.upper().startswith("EMP-")
    ]
    nums = []
    for eid in existing_ids:
        try:
            nums.append(int(eid.split("-")[1]))
        except (IndexError, ValueError):
            pass
    next_num = max(nums) + 1 if nums else 1
    auto_employee_id = f"EMP-{str(next_num).zfill(3)}"

    new_admin = Admin(
        first_name=payload.first_name,
        middle_name=payload.middle_name,
        last_name=payload.last_name,
        email=payload.email,
        phone_number=payload.phone_number,
        employee_id=auto_employee_id,
        username=payload.username,
        position=payload.position,
        is_super_admin=False,  # Created accounts are always regular Admin
        password_hash=hash_password(payload.password),
        created_by=current_admin.id,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin


# ---------------------------------------------------------------------------
# Step 1 — Password Login
# Rate limited per (network, username) on FAILURES only.
#
# This replaced a flat slowapi "5/minute" keyed on the remote address, which
# counted successful logins too and shared one bucket across everyone behind the
# same address — including, behind a reverse proxy, every user. Five legitimate
# sign-ins in a minute during a demo would have returned 429.
# ---------------------------------------------------------------------------
@router.post("/login")
def admin_login(
    request: Request,
    response: Response,
    payload: AdminLogin,
    db: Session = Depends(get_db),
):
    limit_key, ip_key = login_keys("admin_login", request, payload.username)
    for key, sched in ((limit_key, None), (ip_key, IP_LOCKOUT_SCHEDULE)):
        limit_check = check_rate_limit(key)
        if not limit_check["allowed"]:
            raise HTTPException(status_code=429, detail=limit_check["message"])

    admin = db.query(Admin).filter(Admin.username == payload.username).first()
    if not admin or not verify_password(payload.password, admin.password_hash):
        record_failure(limit_key)
        record_failure(ip_key, IP_LOCKOUT_SCHEDULE)
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    if getattr(admin, "is_deleted", False):
        raise HTTPException(status_code=403, detail="Account has been deleted.")
    if not admin.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated.")

    # Both buckets: the network one is never cleared otherwise.
    record_success(limit_key)
    record_success(ip_key)

    token = create_access_token(data={
        "sub": str(admin.id),
        "role": admin.position,
        "is_super_admin": admin.is_super_admin,
        "face_verified": False,  # Everyone must complete face scan
    })

    set_auth_cookie(response, token)

    return {
        "admin": {
            "id": admin.id,
            "first_name": admin.first_name,
            "last_name": admin.last_name,
            "username": admin.username,
            "position": admin.position,
            "is_super_admin": admin.is_super_admin,
            "employee_id": admin.employee_id,
        },
        "needs_face_enrollment": not admin.is_face_enrolled,
        "needs_face_verification": admin.is_face_enrolled,
    }


# ---------------------------------------------------------------------------
# Logout — clears the httponly cookie
# ---------------------------------------------------------------------------
@router.post("/logout")
def admin_logout(response: Response):
    from core.config import settings
    response.delete_cookie(
        key="admin_token",
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,  # Match the set_cookie settings
        secure=settings.COOKIE_SECURE,
    )
    return {"message": "Logged out successfully."}


# ---------------------------------------------------------------------------
# Me — current admin's own profile
# ---------------------------------------------------------------------------
@router.get("/me", response_model=AdminResponse)
def get_me(
    current_admin: Admin = Depends(get_current_admin),
):
    return current_admin


# ---------------------------------------------------------------------------
# Change own password
# ---------------------------------------------------------------------------
@router.patch("/me/change-password")
def change_own_password(
    payload: dict,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    current_password = payload.get("current_password", "")
    new_password     = payload.get("new_password", "")

    if not verify_password(current_password, current_admin.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if current_password == new_password:
        raise HTTPException(status_code=400, detail="New password must be different from your current password.")

    validate_password_strength(new_password)

    current_admin.password_hash = hash_password(new_password)
    db.commit()
    return {"message": "Password changed successfully."}


# ---------------------------------------------------------------------------
# Step 2A — Face Enrollment
# Rate limited: 10 attempts per minute per IP
# ---------------------------------------------------------------------------
@router.post("/enroll-face")
@limiter.limit("10/minute")
def enroll_face(
    request: Request,
    response: Response,
    payload: AdminFaceEnroll,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    if current_admin.is_face_enrolled:
        raise HTTPException(status_code=400, detail="Face already enrolled.")
    if len(payload.descriptor) != 128:
        raise HTTPException(status_code=400, detail="Invalid face descriptor. Must be 128 numbers.")

    current_admin.face_descriptor = payload.descriptor
    current_admin.is_face_enrolled = True
    db.commit()

    token = create_access_token(data={
        "sub": str(current_admin.id),
        "role": current_admin.position,
        "is_super_admin": current_admin.is_super_admin,
        "face_verified": True,
    })

    set_auth_cookie(response, token)
    return {"message": "Face enrolled successfully."}


# ---------------------------------------------------------------------------
# Step 2B — Face Verification
# Rate limited: 10 attempts per minute per IP
# ---------------------------------------------------------------------------
@router.post("/verify-face")
@limiter.limit("10/minute")
def verify_face(
    request: Request,
    response: Response,
    payload: AdminFaceVerify,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    if not current_admin.is_face_enrolled:
        raise HTTPException(status_code=400, detail="Face not enrolled yet.")
    if len(payload.descriptor) != 128:
        raise HTTPException(status_code=400, detail="Invalid face descriptor.")

    # Repeated mismatches are someone trying faces until one lands. The slowapi
    # limit above is per IP per minute; this one is per account and escalates.
    face_key = f"admin_face:{client_ip(request)}:{current_admin.id}"
    gate = check_rate_limit(face_key)
    if not gate["allowed"]:
        raise HTTPException(status_code=429, detail=gate["message"])

    distance = compute_face_distance(payload.descriptor, current_admin.face_descriptor)

    # Is this face a better match for somebody else? In a small office the
    # absolute distance can be inside the threshold for a colleague who simply
    # looks similar; the account it claims must be the closest one.
    nearest_other = None
    others = db.query(Admin).filter(
        Admin.id != current_admin.id,
        Admin.is_face_enrolled == True,      # noqa: E712  (SQLAlchemy needs ==)
        Admin.face_descriptor.isnot(None),
    ).all()
    for other in others:
        try:
            d = compute_face_distance(payload.descriptor, other.face_descriptor)
        except Exception:
            continue
        if nearest_other is None or d < nearest_other:
            nearest_other = d

    matched = distance <= FACE_MATCH_THRESHOLD
    if matched and nearest_other is not None and nearest_other + NEAREST_MARGIN < distance:
        matched = False
        print(f"[FACE] admin {current_admin.id}: closer to another enrolled admin "
              f"({nearest_other:.4f} vs {distance:.4f}) — rejected.")

    if not matched:
        record_failure(face_key)
        # The distance is deliberately NOT returned: it told an attacker how
        # close each attempt was, which is a dial for tuning the next one.
        print(f"[FACE] admin {current_admin.id}: no match (distance {distance:.4f}, "
              f"threshold {FACE_MATCH_THRESHOLD}).")
        raise HTTPException(
            status_code=401,
            detail="Face did not match the enrolled account. Try again in better lighting, "
                   "or ask a Super Admin to reset your face enrollment.",
        )

    record_success(face_key)
    # Logged so the threshold can be calibrated from real attempts: compare the
    # distances your own face produces against the ones a different face does.
    print(f"[FACE] admin {current_admin.id}: match (distance {distance:.4f}, "
          f"threshold {FACE_MATCH_THRESHOLD}"
          + (f", nearest other {nearest_other:.4f}" if nearest_other is not None else "") + ").")

    token = create_access_token(data={
        "sub": str(current_admin.id),
        "role": current_admin.position,
        "is_super_admin": current_admin.is_super_admin,
        "face_verified": True,
    })

    set_auth_cookie(response, token)
    return {"message": "Face verified successfully."}


# ---------------------------------------------------------------------------
# Emergency access — for a camera that fails during a live demonstration
#
# This replaces the old /skip-verify, which needed nothing but a password and so
# cancelled the second factor entirely. Two things differ:
#   1. It is OFF unless FACE_BYPASS_CODE is set in the environment. Unset, every
#      request here is refused, so the deployed default is no bypass at all.
#   2. Even when on, the caller must present that code. A stolen password alone
#      is not enough.
# Every attempt is logged, successful or not.
# ---------------------------------------------------------------------------
class EmergencyAccess(BaseModel):
    code: str


@router.post("/emergency-verify")
@limiter.limit("5/hour")
def emergency_face_bypass(
    request: Request,
    response: Response,
    payload: EmergencyAccess,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    configured = (settings.FACE_BYPASS_CODE or "").strip()
    if not configured:
        print(f"[FACE] emergency access refused for admin {current_admin.id}: not enabled.")
        raise HTTPException(
            status_code=403,
            detail="Emergency access is not enabled. Ask a Super Admin to reset your face enrollment instead.",
        )

    # compare_digest so a wrong code cannot be narrowed down by timing.
    if not secrets.compare_digest(payload.code.strip(), configured):
        print(f"[FACE] emergency access DENIED for admin {current_admin.id}: wrong code.")
        raise HTTPException(status_code=401, detail="Incorrect emergency code.")

    print(f"[FACE] EMERGENCY ACCESS USED by admin {current_admin.id} "
          f"({current_admin.username}) — face check skipped.")

    token = create_access_token(data={
        "sub": str(current_admin.id),
        "role": current_admin.position,
        "is_super_admin": current_admin.is_super_admin,
        "face_verified": True,
    })
    set_auth_cookie(response, token)
    return {"message": "Emergency access granted. This was recorded in the server log."}


# ---------------------------------------------------------------------------
# Super Admin: List Active Admins
# ---------------------------------------------------------------------------
@router.get("/admins", response_model=list[AdminResponse])
def list_admins(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    return db.query(Admin).filter(
        Admin.is_super_admin == False,
        Admin.is_deleted == False,
    ).all()


# ---------------------------------------------------------------------------
# Super Admin: List Recently Deleted — MUST be before /{admin_id} routes
# ---------------------------------------------------------------------------
@router.get("/admins/deleted", response_model=list[AdminResponse])
def list_deleted_admins(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    cutoff = datetime.utcnow() - timedelta(days=30)
    return db.query(Admin).filter(
        Admin.is_deleted == True,
        Admin.deleted_at >= cutoff,
        Admin.is_super_admin == False,
    ).all()


# ---------------------------------------------------------------------------
# Super Admin: Cleanup expired deleted admins
# MUST be before /admins/{admin_id} — "cleanup" would be parsed as an int
# otherwise and return a 422 instead of routing here.
# ---------------------------------------------------------------------------
@router.delete("/admins/cleanup")
def cleanup_deleted_admins(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    cutoff = datetime.utcnow() - timedelta(days=30)
    expired = db.query(Admin).filter(
        Admin.is_deleted == True,
        Admin.deleted_at < cutoff,
    ).all()
    count = len(expired)
    for a in expired:
        db.delete(a)
    db.commit()
    return {"message": f"Permanently deleted {count} expired admin account(s)."}


# ---------------------------------------------------------------------------
# Super Admin: Deactivate Admin
# ---------------------------------------------------------------------------
@router.patch("/admins/{admin_id}/deactivate")
def deactivate_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")
    if admin.is_super_admin:
        raise HTTPException(status_code=403, detail="Cannot deactivate Super Admin.")
    admin.is_active = False
    db.commit()
    return {"message": f"{admin.first_name}'s account has been deactivated."}


# ---------------------------------------------------------------------------
# Super Admin: Reactivate Admin
# ---------------------------------------------------------------------------
@router.patch("/admins/{admin_id}/reactivate")
def reactivate_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")
    admin.is_active = True
    db.commit()
    return {"message": f"{admin.first_name}'s account has been reactivated."}


# ---------------------------------------------------------------------------
# Super Admin: Reset Face
# ---------------------------------------------------------------------------
@router.patch("/admins/{admin_id}/reset-face")
def reset_face(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    """Clear an admin's face enrollment so they enrol again at next sign-in.

    Requires a face-verified Super Admin session, not just a password. Reset
    plus enrol is a way in: with only a password, someone could wipe the real
    admin's face, enrol their own at the next step, and own the account. The
    face check on THIS call is what closes that path.
    """
    if not current_admin.is_super_admin:
        raise HTTPException(status_code=403, detail="Super Admin access required.")

    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")
    admin.face_descriptor = None
    admin.is_face_enrolled = False
    db.commit()
    print(f"[FACE] admin {admin.id} face reset by super admin {current_admin.id}.")
    return {"message": f"Face data reset for {admin.first_name}."}


# ---------------------------------------------------------------------------
# Any admin: reset their OWN face enrollment
# ---------------------------------------------------------------------------
@router.patch("/me/reset-face")
def reset_my_face(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin_full_access),
):
    """Re-enrol your own face, for a new haircut, glasses, or a bad first scan.

    Face-verified only: the session must already have proved it is this person,
    so a stolen password on its own cannot swap the enrolled face.
    """
    current_admin.face_descriptor = None
    current_admin.is_face_enrolled = False
    db.commit()
    print(f"[FACE] admin {current_admin.id} reset their own face enrollment.")
    return {"message": "Your face enrollment has been cleared. You will enrol again at your next sign-in."}


# ---------------------------------------------------------------------------
# Super Admin: Recover Deleted Admin
# ---------------------------------------------------------------------------
@router.patch("/admins/{admin_id}/recover")
def recover_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    cutoff = datetime.utcnow() - timedelta(days=30)
    admin = db.query(Admin).filter(
        Admin.id == admin_id,
        Admin.is_deleted == True,
        Admin.deleted_at >= cutoff,
    ).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found or recovery period has expired.")
    admin.is_deleted = False
    admin.deleted_at = None
    admin.is_active = True
    db.commit()
    return {"message": f"{admin.first_name}'s account has been recovered successfully."}


# ---------------------------------------------------------------------------
# Refresh — issues a new cookie before the old one expires
# ---------------------------------------------------------------------------
@router.post("/refresh")
def admin_refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    from core.security import decode_access_token
    token = request.cookies.get("admin_token")
    if not token:
        raise HTTPException(status_code=401, detail="No session found.")

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")

    admin_id = int(payload.get("sub", 0))
    admin = db.query(Admin).filter(Admin.id == admin_id, Admin.is_active == True).first()
    if not admin or getattr(admin, "is_deleted", False):
        raise HTTPException(status_code=401, detail="Account not found or deactivated.")

    # Issue a fresh token with same claims
    new_token = create_access_token(data={
        "sub": str(admin.id),
        "role": admin.position,
        "is_super_admin": admin.is_super_admin,
        "face_verified": payload.get("face_verified", False),
    })
    set_auth_cookie(response, new_token)
    return {"message": "Session refreshed."}


# ---------------------------------------------------------------------------
# Super Admin: Reset any admin's password
# ---------------------------------------------------------------------------
@router.patch("/admins/{admin_id}/reset-password")
def reset_admin_password(
    admin_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    admin = db.query(Admin).filter(Admin.id == admin_id, Admin.is_deleted == False).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")
    if admin.is_super_admin and admin.id != current_admin.id:
        raise HTTPException(status_code=403, detail="Cannot reset another Super Admin's password.")

    new_password = payload.get("new_password", "")
    validate_password_strength(new_password)
    admin.password_hash = hash_password(new_password)
    db.commit()
    return {"message": f"Password for {admin.username} has been reset successfully."}


# ---------------------------------------------------------------------------
# Super Admin: Edit an admin's name (own name included; not another super admin)
# ---------------------------------------------------------------------------
@router.patch("/admins/{admin_id}/name", response_model=AdminResponse)
def update_admin_name(
    admin_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    admin = db.query(Admin).filter(Admin.id == admin_id, Admin.is_deleted == False).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")
    if admin.is_super_admin and admin.id != current_admin.id:
        raise HTTPException(status_code=403, detail="Cannot edit another Super Admin's name.")

    first  = (payload.get("first_name")  or "").strip()
    middle = (payload.get("middle_name") or "").strip()
    last   = (payload.get("last_name")   or "").strip()
    if not first or not last:
        raise HTTPException(status_code=400, detail="First name and last name are required.")

    admin.first_name  = first
    admin.middle_name = middle or None
    admin.last_name   = last
    db.commit()
    db.refresh(admin)
    return admin


# ---------------------------------------------------------------------------
# Super Admin: Soft Delete Admin
# ---------------------------------------------------------------------------
@router.delete("/admins/{admin_id}")
def delete_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin),
):
    admin = db.query(Admin).filter(Admin.id == admin_id, Admin.is_deleted == False).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")
    if admin.is_super_admin:
        raise HTTPException(status_code=403, detail="Cannot delete Super Admin.")
    admin.is_deleted = True
    admin.deleted_at = datetime.utcnow()
    admin.is_active = False
    db.commit()
    return {"message": f"{admin.first_name}'s account has been deleted. It can be recovered within 30 days."}
