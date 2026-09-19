import random
import string
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models.otp import OTP
from core.config import settings
from utils.email_templates import otp_email
from fastapi import HTTPException

SEMAPHORE_URL = "https://api.semaphore.co/api/v4/messages"


OTP_EXPIRE_MINUTES = 5


def generate_otp_code() -> str:
    return "".join(random.choices(string.digits, k=6))


def create_otp(db: Session, user_id: int) -> str:
    db.query(OTP).filter(OTP.user_id == user_id, OTP.is_used == False).delete()

    code = generate_otp_code()
    otp = OTP(
        user_id=user_id,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES),
    )
    db.add(otp)
    db.commit()
    db.refresh(otp)
    return code


def verify_otp(db: Session, user_id: int, code: str) -> bool:
    otp = (
        db.query(OTP)
        .filter(
            OTP.user_id == user_id,
            OTP.code == code,
            OTP.is_used == False,
            OTP.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not otp:
        return False

    otp.is_used = True
    db.commit()
    return True


def _normalize_ph_number(phone: str) -> str:
    """Normalize a Philippine mobile number for Semaphore (09xxxxxxxxx or 639xxxxxxxxx)."""
    d = "".join(ch for ch in (phone or "") if ch.isdigit())
    if d.startswith("63") and len(d) == 12:      # 639171234567
        return d
    if d.startswith("0") and len(d) == 11:       # 09171234567
        return d
    if len(d) == 10 and d.startswith("9"):       # 9171234567 -> 09171234567
        return "0" + d
    return d or (phone or "")


def sms_enabled() -> bool:
    """Whether SMS is worth attempting at all.

    Needs both a key and the explicit switch: the account can hold credits and a
    valid key while every send still fails because no sender name is approved.
    """
    return bool(getattr(settings, "SMS_ENABLED", False)) and bool((getattr(settings, "SMS_API_KEY", "") or "").strip())


def send_sms(phone_number: str, message: str) -> bool:
    """
    Send an SMS via Semaphore (https://semaphore.co). Returns True if sent.
    Never raises — a failed SMS must not break the caller. Falls back to
    console output when SMS_API_KEY is not configured (dev).
    """
    if not sms_enabled():
        print(f"[SMS] skipped for {phone_number}: SMS is disabled (no approved sender name).")
        return False

    api_key = getattr(settings, "SMS_API_KEY", "") or ""
    if not api_key:
        print(f"[DEV] SMS to {phone_number}: {message}  (SMS_API_KEY not set — SMS skipped)")
        return False
    try:
        payload = {
            "apikey":     api_key,
            "number":     _normalize_ph_number(phone_number),
            "message":    message,
            # Semaphore requires an active sender name; "SEMAPHORE" is the default.
            "sendername": (getattr(settings, "SMS_SENDER", "") or "").strip() or "SEMAPHORE",
        }

        resp = requests.post(SEMAPHORE_URL, data=payload, timeout=15)
        if resp.status_code in (200, 201):
            print(f"[SMS] sent to {phone_number} via Semaphore.")
            return True
        print(f"[SMS] Semaphore error {resp.status_code}: {resp.text[:300]}")
        return False
    except Exception as e:
        print(f"[SMS] Failed to send SMS via Semaphore: {e}")
        return False


def send_otp_sms(phone_number: str, code: str) -> bool:
    """Send the OTP via SMS. Returns False if it did not go, so the caller can
    fall back to email rather than leaving the person waiting for a text."""
    message = (
        f"Your VAWC-Response verification code is {code}. "
        f"It expires in {OTP_EXPIRE_MINUTES} minutes. Do not share this code with anyone."
    )
    return send_sms(phone_number, message)


def send_otp_email(email: str, code: str, verify_link: str = None):
    """Send the verification code. Layout lives in utils/email_templates.py."""
    try:
        subject, body = otp_email(code, verify_link=verify_link,
                                  expire_minutes=OTP_EXPIRE_MINUTES)
        send_html_email(email, subject, body)
        print(f"[EMAIL] OTP sent to {email}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send to {email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP email. Please try again.")


def send_html_email(to_email: str, subject: str, html_body: str):
    """
    Send an HTML email. Uses the Brevo HTTPS API in production (when BREVO_API_KEY
    is set) because hosts like Render block outbound SMTP ports; falls back to
    Gmail SMTP locally. Raises HTTPException(500) on failure.
    """
    if (getattr(settings, "BREVO_API_KEY", "") or "").strip():
        _send_email_brevo(to_email, subject, html_body)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.GMAIL_USER
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as server:
        server.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)
        server.sendmail(settings.GMAIL_USER, to_email, msg.as_string())


def _send_email_brevo(to_email: str, subject: str, html_body: str):
    """Send an HTML email via the Brevo (Sendinblue) transactional email API over HTTPS."""
    sender_email = (getattr(settings, "BREVO_SENDER_EMAIL", "") or settings.GMAIL_USER or "").strip()
    sender_name = (getattr(settings, "BREVO_SENDER_NAME", "") or "VAWC-Response").strip()
    resp = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "api-key": settings.BREVO_API_KEY.strip(),
            "Content-Type": "application/json",
            "accept": "application/json",
        },
        json={
            "sender": {"name": sender_name, "email": sender_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_body,
        },
        timeout=20,
    )
    if resp.status_code not in (200, 201, 202):
        print(f"[EMAIL] Brevo error {resp.status_code}: {resp.text[:300]}")
        raise HTTPException(status_code=500, detail="Failed to send OTP email. Please try again.")
    print(f"[EMAIL] OTP sent to {to_email} via Brevo.")