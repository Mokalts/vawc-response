from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import get_db
from models.admin import Admin
from schemas.admin import AdminCreate, AdminLogin, AdminFaceEnroll, AdminFaceVerify, AdminResponse, AdminTokenResponse
from core.security import hash_password, verify_password, create_access_token
from core.admin_dependencies import get_current_admin, require_super_admin
from slowapi import Limiter
from slowapi.util import get_remote_address
import numpy as np
import re


router = APIRouter(prefix="/admin/auth", tags=["Admin Auth"])
limiter = Limiter(key_func=get_remote_address)

# Euclidean distance between 128-d face descriptors (face-api.js).
# Lower = stricter. Typical range 0.4 – 0.6. For a small organization (few admins,
# no twin look-alikes) 0.55 – 0.60 reduces false rejections caused by poor
# lighting / camera angle without meaningfully increasing false acceptances.
FACE_MATCH_THRESHOLD = 0.58


def compute_face_distance(descriptor1: list, descriptor2: list) -> float:
    a = np.array(descriptor1)
    b = np.array(descriptor2)
    return float(np.linalg.norm(a - b))


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="admin_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,        # Set to True when HTTPS is live
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
# Rate limited: 5 attempts per minute per IP
# ---------------------------------------------------------------------------
@router.post("/login")
@limiter.limit("5/minute")
def admin_login(
    request: Request,
    response: Response,
    payload: AdminLogin,
    db: Session = Depends(get_db),
):
    admin = db.query(Admin).filter(Admin.username == payload.username).first()
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    if getattr(admin, "is_deleted", False):
        raise HTTPException(status_code=403, detail="Account has been deleted.")
    if not admin.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated.")

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
    response.delete_cookie(
        key="admin_token",
        httponly=True,
        samesite="lax",
        secure=False,  # Match the set_cookie settings
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

    distance = compute_face_distance(payload.descriptor, current_admin.face_descriptor)
    if distance > FACE_MATCH_THRESHOLD:
        raise HTTPException(status_code=401, detail=f"Face did not match. Distance: {distance:.4f}")

    token = create_access_token(data={
        "sub": str(current_admin.id),
        "role": current_admin.position,
        "is_super_admin": current_admin.is_super_admin,
        "face_verified": True,
    })

    set_auth_cookie(response, token)
    return {"message": "Face verified successfully."}


# ---------------------------------------------------------------------------
# TEMPORARY DEV BYPASS — Skip face verification
# Issues a fully-authenticated cookie without face check.
# TODO: Remove this endpoint before production deployment.
# ---------------------------------------------------------------------------
@router.post("/skip-verify")
def skip_face_verify(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
):
    token = create_access_token(data={
        "sub": str(current_admin.id),
        "role": current_admin.position,
        "is_super_admin": current_admin.is_super_admin,
        "face_verified": True,
    })
    set_auth_cookie(response, token)
    return {"message": "Face verification skipped (dev mode)."}


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
    current_admin: Admin = Depends(require_super_admin),
):
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")
    admin.face_descriptor = None
    admin.is_face_enrolled = False
    db.commit()
    return {"message": f"Face data reset for {admin.first_name}."}


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
