from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.otp import OTP
from schemas.user import UserResponse, UserUpdate, PasswordChange
from core.dependencies import get_current_user
from core.security import verify_password, hash_password
from datetime import datetime, timedelta
from pydantic import BaseModel

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
    if payload.first_name is not None:
        current_user.first_name = payload.first_name
    if payload.middle_name is not None:
        current_user.middle_name = payload.middle_name
    if payload.last_name is not None:
        current_user.last_name = payload.last_name
    if payload.address is not None:
        current_user.address = payload.address
    if payload.birthdate is not None:
        current_user.birthdate = payload.birthdate
    if payload.sex is not None:
        current_user.sex = payload.sex
    if payload.phone_number is not None:
        existing = db.query(User).filter(
            User.phone_number == payload.phone_number,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already in use.")
        current_user.phone_number = payload.phone_number

    db.commit()
    db.refresh(current_user)
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
    db.commit()
    return {"message": "Password updated successfully."}


@router.delete("/me")
def delete_my_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Soft delete only — reports are kept as evidence
    # OTPs cleaned up since they're temporary tokens
    db.query(OTP).filter(OTP.user_id == current_user.id).delete()

    current_user.is_deleted = True
    current_user.deleted_at = datetime.utcnow()
    db.commit()

    return {"message": "Account deleted. You can recover it within 30 days by signing in."}


@router.post("/recover")
def recover_account(
    payload: RecoverAccountPayload,
    db: Session = Depends(get_db),
):
    """Public endpoint — recover a soft-deleted account from the sign-in page."""
    user = db.query(User).filter(User.email == payload.email).first()

    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email.")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password.")

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
