from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.otp import OTP
from schemas.user import UserRegister, UserLogin, TokenResponse, UserResponse
from schemas.otp import OTPRequest, OTPVerify
from core.security import hash_password, verify_password, create_access_token, create_verify_token, decode_verify_token
from core.progressive_limiter import check_rate_limit, record_failure, record_success
from utils.otp_helper import create_otp, verify_otp, send_otp_sms, send_otp_email
from pydantic import BaseModel
from datetime import datetime, timedelta
import re
import requests
from core.security import create_access_token
from core.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

FRONTEND_URL = "http://localhost:3000"

from core.config import settings
ABSTRACT_API_KEY = settings.ABSTRACT_API_KEY

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    identifier: str

class VerifyOTPForReset(BaseModel):
    identifier: str
    code: str

class ResetPasswordPayload(BaseModel):
    identifier: str
    new_password: str

class ResendEmailOTP(BaseModel):
    phone_number: str


# ─── Password validator ───────────────────────────────────────────────────────

def validate_password_strength(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must include at least one uppercase letter.")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail="Password must include at least one number.")
    if not re.search(r"[!@#$%^&*()\,.\?\":{}|<>_\-]", password):
        raise HTTPException(status_code=400, detail="Password must include at least one special character.")


# ─── Email validator (AbstractAPI) ───────────────────────────────────────────

def validate_email_exists(email: str):
    try:
        response = requests.get(
            "https://emailvalidation.abstractapi.com/v1/",
            params={"api_key": ABSTRACT_API_KEY, "email": email},
            timeout=5,
        )
        data = response.json()
        deliverability = data.get("deliverability", "").upper()
        if deliverability == "UNDELIVERABLE":
            raise HTTPException(
                status_code=400,
                detail="This email address does not exist or cannot receive emails. Please use a valid email."
            )
    except HTTPException:
        raise
    except Exception:
        pass


# ─── Helper ───────────────────────────────────────────────────────────────────

def get_user_by_identifier(identifier: str, db: Session) -> User:
    user = db.query(User).filter(User.email == identifier).first()
    if not user:
        user = db.query(User).filter(User.phone_number == identifier).first()
    return user


# ─── Register ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    validate_password_strength(payload.password)
    validate_email_exists(payload.email)

    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        if not existing_user.is_verified:
            window_expired = (datetime.utcnow() - existing_user.created_at) > timedelta(hours=1)
            if window_expired:
                db.query(OTP).filter(OTP.user_id == existing_user.id).delete()
                db.delete(existing_user)
                db.commit()
            else:
                return JSONResponse(status_code=409, content={
                    "code": "PENDING_VERIFICATION",
                    "message": "This email is already registered but not yet verified. Please check your messages for the OTP or request a new one.",
                    "phone_number": existing_user.phone_number,
                    "email": existing_user.email,
                })
        else:
            raise HTTPException(status_code=400, detail="Email already registered.")

    if db.query(User).filter(User.phone_number == payload.phone_number).first():
        raise HTTPException(status_code=400, detail="Phone number already registered.")

    user = User(
        first_name=payload.first_name,
        middle_name=payload.middle_name,
        last_name=payload.last_name,
        email=payload.email,
        phone_number=payload.phone_number,
        birthdate=payload.birthdate,
        sex=payload.sex,
        address=payload.address,
        password_hash=hash_password(payload.password),
        is_verified=False,
        is_minor=payload.is_minor,
        guardian_name=payload.guardian_name if payload.is_minor else None,
        guardian_relationship=payload.guardian_relationship if payload.is_minor else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    code = create_otp(db, user.id)
    verify_token = create_verify_token(user.id)
    verify_link = f"{FRONTEND_URL}/verify?token={verify_token}"

    send_otp_email(user.email, code, verify_link=verify_link)
    send_otp_sms(user.phone_number, code)

    return user


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host
    limit_key = f"victim_login:{client_ip}"

    limit_check = check_rate_limit(limit_key)
    if not limit_check["allowed"]:
        raise HTTPException(status_code=429, detail=limit_check["message"])

    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        record_failure(limit_key)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if getattr(user, "is_deleted", False):
        cutoff = datetime.utcnow() - timedelta(days=30)
        deleted_at = getattr(user, "deleted_at", None)
        if deleted_at and deleted_at < cutoff:
            raise HTTPException(status_code=403, detail="account_permanently_deleted")
        else:
            raise HTTPException(status_code=403, detail="account_deleted")

    if not user.is_verified:
        window_expired = (datetime.utcnow() - user.created_at) > timedelta(hours=1)
        if window_expired:
            db.query(OTP).filter(OTP.user_id == user.id).delete()
            db.delete(user)
            db.commit()
            raise HTTPException(status_code=403, detail="unverified_expired")
        else:
            raise HTTPException(status_code=403, detail="unverified_pending")

    record_success(limit_key)

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


# ─── OTP: Send to Phone ───────────────────────────────────────────────────────

@router.post("/otp/send")
def send_otp(payload: OTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone_number == payload.phone_number).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    code = create_otp(db, user.id)
    send_otp_sms(user.phone_number, code)
    return {"message": "OTP sent to mobile number."}


# ─── OTP: Send to Email ───────────────────────────────────────────────────────

@router.post("/otp/send-email")
def send_otp_email_route(payload: ResendEmailOTP, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone_number == payload.phone_number).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not user.email:
        raise HTTPException(status_code=400, detail="No email address on file.")

    code = create_otp(db, user.id)
    verify_token = create_verify_token(user.id)
    verify_link = f"{FRONTEND_URL}/verify?token={verify_token}"
    send_otp_email(user.email, code, verify_link=verify_link)
    return {"message": "OTP sent to email."}


# ─── OTP: Verify (registration) ───────────────────────────────────────────────

@router.post("/otp/verify")
def verify_otp_route(payload: OTPVerify, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone_number == payload.phone_number).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    success = verify_otp(db, user.id, payload.code)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    user.is_verified = True
    db.commit()

    token = create_access_token({"sub": str(user.id)})
    return {"message": "OTP verified successfully.", "access_token": token, "token_type": "bearer"}


# ─── Verify via Email Link ────────────────────────────────────────────────────

@router.get("/verify-link")
def verify_via_link(token: str, db: Session = Depends(get_db)):
    user_id = decode_verify_token(token)
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.is_verified:
        return {"message": "Account already verified.", "already_verified": True}

    user.is_verified = True
    db.commit()

    access_token = create_access_token({"sub": str(user.id)})
    return {"message": "Account verified successfully.", "access_token": access_token, "token_type": "bearer"}


# ─── Forgot Password: Step 1 ─────────────────────────────────────────────────

@router.post("/forgot-password/request")
def forgot_password_request(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = get_user_by_identifier(payload.identifier, db)
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email or phone number.")

    code = create_otp(db, user.id)

    if "@" in payload.identifier:
        send_otp_email(user.email, code)
        if user.phone_number:
            send_otp_sms(user.phone_number, code)
    else:
        send_otp_sms(payload.identifier, code)

    return {"message": "OTP sent successfully."}


# ─── Forgot Password: Step 2 ─────────────────────────────────────────────────

@router.post("/forgot-password/verify-otp")
def forgot_password_verify_otp(payload: VerifyOTPForReset, db: Session = Depends(get_db)):
    user = get_user_by_identifier(payload.identifier, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    success = verify_otp(db, user.id, payload.code)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    return {"message": "OTP verified. You may now reset your password."}


# ─── Forgot Password: Step 3 ─────────────────────────────────────────────────

@router.post("/forgot-password/reset")
def reset_password(payload: ResetPasswordPayload, db: Session = Depends(get_db)):
    user = get_user_by_identifier(payload.identifier, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    validate_password_strength(payload.new_password)

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password reset successfully."}


@router.post("/refresh")
def refresh_victim_token(current_user: User = Depends(get_current_user)):
    if not current_user.is_verified:
        raise HTTPException(status_code=403, detail="Account not verified.")
    new_token = create_access_token(data={"sub": str(current_user.id)})
    return {
        "access_token": new_token,
        "token_type": "bearer",
    }
