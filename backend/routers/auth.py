from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.otp import OTP
from schemas.user import UserRegister, UserLogin, TokenResponse, UserResponse, RegisterResponse
from schemas.otp import OTPRequest, OTPVerify
from core.security import (
    hash_password, verify_password, create_access_token,
    create_verify_token, decode_verify_token,
    create_reset_token, decode_reset_token, password_fingerprint,
    create_id_submit_token,
)
from slowapi import Limiter
from core.progressive_limiter import (
    check_rate_limit, record_failure, record_success, login_keys, IP_LOCKOUT_SCHEDULE, client_ip,
)
from utils.otp_helper import create_otp, verify_otp, send_otp_sms, send_otp_email, sms_enabled
from utils.id_ocr import read_id
from pydantic import BaseModel
from datetime import datetime, timedelta
import re
import requests
from core.security import create_access_token
from core.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Per-IP caps on the endpoints that send messages or accept guesses. Without
# these, one script could text a victim's phone all night on the barangay's
# Semaphore credits, or work through a six-digit code at will.
# Keyed on the caller's own address, not slowapi's get_remote_address. That
# returns request.client.host, which behind Render's proxy is the proxy itself
# and therefore identical for every user on the internet: "12 registrations an
# hour" then meant twelve for the whole barangay, and one tester's signups
# locked out the next person in the queue. client_ip reads the forwarded address
# the way the login lockout already did.
limiter = Limiter(key_func=client_ip)

# Said to everyone, whether or not the account exists. Telling a stranger that a
# number is registered tells an abuser that his partner has reported.
GENERIC_SEND_OK = {"message": "If that account exists, a code has been sent."}

from core.config import settings

# Where email links point. Hardcoding localhost here shipped verification
# emails whose button only worked on a developer's machine.
FRONTEND_URL = settings.FRONTEND_URL.rstrip("/")

ABSTRACT_API_KEY = settings.ABSTRACT_API_KEY

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    identifier: str

class VerifyOTPForReset(BaseModel):
    identifier: str
    code: str

class ResetPasswordPayload(BaseModel):
    # The token handed back by /forgot-password/verify-otp, which is only issued
    # once a correct code has been presented. This endpoint used to take an
    # identifier and a new password with nothing linking the two steps.
    reset_token: str
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



def _deliver_code(user, code: str, prefer_sms: bool = False) -> None:
    """Get the code to the person. Email always goes; SMS goes as well.

    Email is not a fallback here, it is the channel that is actually known to
    have worked. The SMS gateway is an Android handset, and all it can report is
    that the message was ACCEPTED for sending. Everything that happens after
    that is invisible to this server: the phone can be out of load, out of
    signal, switched off, or unable to choose between two SIMs. Every one of
    those fails after the request has already come back as a success.

    This used to send the email only when the SMS call returned false, which
    made the accepted-but-not-sent case the worst one in the system: the person
    was told a code had been sent, and no code existed anywhere she could reach.
    Sending both costs a duplicate email in the normal case and guarantees the
    code arrives in every case, which is the right way round for a login someone
    may be attempting while in danger.

    Nothing in here may raise: these endpoints answer identically for known and
    unknown accounts, and an exception escaping would turn a delivery failure
    into a 500 that reveals the account exists.
    """
    sms_sent = False
    if prefer_sms and user.phone_number:
        try:
            sms_sent = send_otp_sms(user.phone_number, code)
        except Exception as e:  # noqa: BLE001
            print(f"[OTP] SMS failed for user {user.id}: {e}")

    emailed = False
    if user.email:
        try:
            verify_link = f"{FRONTEND_URL}/verify?token={create_verify_token(user.id)}"
            send_otp_email(user.email, code, verify_link=verify_link)
            emailed = True
        except Exception as e:  # noqa: BLE001
            print(f"[OTP] email failed for user {user.id}: {e}")

    if not emailed and not sms_sent:
        print(f"[OTP] no channel delivered a code to user {user.id}.")


@router.get("/channels")
def available_channels():
    """Which delivery channels the app should offer. Public and non-identifying:
    it describes the server's configuration, not any account."""
    return {"sms": sms_enabled(), "email": True}


# ─── Register ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("12/hour")
def register(request: Request, payload: UserRegister, db: Session = Depends(get_db)):
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
                # No phone_number or email echoed back: those belong to whoever
                # registered, and anyone can reach this by guessing an address.
                # The client already knows what was typed into its own form.
                return JSONResponse(status_code=409, content={
                    "code": "PENDING_VERIFICATION",
                    "message": "This email is already registered but not yet verified. Please check your messages for the OTP or request a new one.",
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

    # OTP email is on the critical path (user waits for it), so send synchronously.
    # If it cannot be delivered, undo the registration. Leaving the row behind
    # would give her an account she can never verify: the next attempt inside
    # the hour answers PENDING_VERIFICATION and tells her to check messages that
    # were never sent, and a resend answers "a code has been sent" either way.
    try:
        send_otp_email(user.email, code, verify_link=verify_link)
    except Exception:
        db.query(OTP).filter(OTP.user_id == user.id).delete()
        db.delete(user)
        db.commit()
        raise
    # SMS is a secondary channel: run it in the background so a slow provider,
    # or a gateway handset that has to be woken, never delays the registration
    # response. Skipped entirely while SMS is switched off, and the code has
    # already gone out by email by this point either way.
    if sms_enabled():
        import threading
        threading.Thread(target=send_otp_sms, args=(user.phone_number, code), daemon=True).start()

    # The form sends the ID photograph next, on the same button press. It has no
    # session yet and will not get one until an officer approves that ID, so it
    # is handed the single-purpose token that opens the upload and nothing else.
    out = UserResponse.model_validate(user).model_dump()
    out["id_token"] = create_id_submit_token(user.id)
    return out


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    # Two buckets. The account bucket is per (network, email) so one person's
    # typos cannot lock out everyone else sharing a venue's wifi — which would
    # have ended a pilot-testing session. The ip bucket is a flat, forgiving
    # guard against bulk credential stuffing.
    limit_key, ip_key = login_keys("victim_login", request, payload.email)

    for key, sched in ((limit_key, None), (ip_key, IP_LOCKOUT_SCHEDULE)):
        limit_check = check_rate_limit(key)
        if not limit_check["allowed"]:
            raise HTTPException(status_code=429, detail=limit_check["message"])

    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.password_hash):
        record_failure(limit_key)
        record_failure(ip_key, IP_LOCKOUT_SCHEDULE)
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

    # Sign-in waits on a barangay officer approving her ID. The password was
    # right, so the failure buckets are cleared first: this is not a failed
    # login attempt and must not count toward a lockout.
    record_success(limit_key)
    record_success(ip_key)

    if (user.id_status or "none") != "approved":
        # No session is issued. What comes back is a single-purpose token that
        # opens the ID upload and nothing else, because otherwise a rejected ID
        # would strand the account: locked out, and with no way to send another.
        #
        # The hotlines need no account at all, which is the answer for someone
        # in danger while this is pending, and the app says so on this screen.
        raise HTTPException(
            status_code=403,
            detail={
                "code": "id_not_verified",
                "id_status": user.id_status or "none",
                "id_type": user.id_type,
                "reject_reason": user.id_reject_reason,
                "id_token": create_id_submit_token(user.id),
            },
        )

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


# ─── OTP: Send to Phone ───────────────────────────────────────────────────────

@router.post("/otp/send")
@limiter.limit("3/minute")
@limiter.limit("15/hour")
def send_otp(request: Request, payload: OTPRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone_number == payload.phone_number).first()
    if user:
        code = create_otp(db, user.id)
        _deliver_code(user, code, prefer_sms=True)
    return GENERIC_SEND_OK


# ─── OTP: Send to Email ───────────────────────────────────────────────────────

@router.post("/otp/send-email")
@limiter.limit("3/minute")
@limiter.limit("15/hour")
def send_otp_email_route(request: Request, payload: ResendEmailOTP, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone_number == payload.phone_number).first()
    if user:
        code = create_otp(db, user.id)
        _deliver_code(user, code)
    return GENERIC_SEND_OK


# ─── OTP: Verify (registration) ───────────────────────────────────────────────

@router.post("/otp/verify")
@limiter.limit("10/minute")
def verify_otp_route(request: Request, payload: OTPVerify, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone_number == payload.phone_number).first()
    # Same answer for "no such number" and "wrong code", so this cannot be used
    # to find out which numbers are registered.
    success = verify_otp(db, user.id, payload.code) if user else False
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
@limiter.limit("3/minute")
@limiter.limit("10/hour")
def forgot_password_request(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = get_user_by_identifier(payload.identifier, db)

    # Nothing in the response distinguishes a registered account from an unknown
    # one. "No account found with that email or phone number" let anyone confirm
    # that a particular woman has an account on a VAWC reporting system.
    if user:
        code = create_otp(db, user.id)
        # A phone number was previously SMS-only, so with SMS off the code never
        # arrived and the screen sat waiting for a text that was never sent.
        _deliver_code(user, code, prefer_sms="@" not in payload.identifier)

    return GENERIC_SEND_OK


# ─── Forgot Password: Step 2 ─────────────────────────────────────────────────

@router.post("/forgot-password/verify-otp")
@limiter.limit("10/minute")
def forgot_password_verify_otp(request: Request, payload: VerifyOTPForReset, db: Session = Depends(get_db)):
    user = get_user_by_identifier(payload.identifier, db)
    success = verify_otp(db, user.id, payload.code) if user else False
    if not success:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    # The code is now spent. This token is the only thing that will let the next
    # step change the password, and it lasts ten minutes.
    return {
        "message": "OTP verified. You may now reset your password.",
        "reset_token": create_reset_token(user.id, password_fingerprint(user.password_hash)),
    }


# ─── Forgot Password: Step 3 ─────────────────────────────────────────────────

@router.post("/forgot-password/reset")
@limiter.limit("10/minute")
def reset_password(request: Request, payload: ResetPasswordPayload, db: Session = Depends(get_db)):
    """Set a new password, for the account named by the reset token.

    The account comes from the token, never from the request body: taking an
    identifier here is what allowed anyone to set any account's password without
    ever holding the code.
    """
    expired = HTTPException(
        status_code=400,
        detail="This password reset has expired. Please request a new code.",
    )

    user_id, pw_fingerprint = decode_reset_token(payload.reset_token)
    if not user_id:
        raise expired

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise expired

    # Single use: the fingerprint stops matching the moment the password changes.
    if pw_fingerprint != password_fingerprint(user.password_hash):
        raise expired

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


# ─── POST /auth/read-id — read a photographed ID to prefill the form ─────────

ID_READ_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
ID_READ_MAX_MB = 10


@router.post("/read-id")
@limiter.limit("6/minute")
@limiter.limit("30/hour")
async def read_id_for_form(request: Request, file: UploadFile = File(...)):
    """Read a photographed ID and offer back what it says. Stores nothing.

    This exists so she does not have to type what is already printed on the card
    she just photographed. The bytes are read, passed to the OCR service, and
    dropped. Nothing is written to Cloudinary, nothing is written to the
    database, and no account is touched or created.

    That is the difference from the endpoint this replaces, which uploaded the
    photograph before any account existed and handed back a signed reference to
    it. An unauthenticated endpoint that stores images is a place to dump
    images; one that only reads them is not. The rate limits are here because
    the OCR quota is still spendable, which is the only thing left to abuse.

    Unauthenticated because at this point she has no account, which is also why
    it can say nothing about any account. It answers identically for everyone.

    Everything it returns is a SUGGESTION, filled only into fields she has left
    empty and editable afterwards. "Any ID" means no common layout, so partial
    and wrong results are the normal case, and a misread surname that nobody
    corrects would end up on a Barangay Protection Order.
    """
    if file.content_type not in ID_READ_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WEBP or HEIC images are allowed.")

    file_bytes = await file.read()
    if len(file_bytes) > ID_READ_MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"That image is too large. Maximum {ID_READ_MAX_MB}MB.")

    result = read_id(file_bytes, file.filename or "id.jpg")
    return {
        "suggestions": result.get("suggestions", {}),
        "scanned": result.get("text_found", False),
    }
