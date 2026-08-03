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


def send_sms(phone_number: str, message: str) -> bool:
    """
    Send an SMS via Semaphore (https://semaphore.co). Returns True if sent.
    Never raises — a failed SMS must not break the caller. Falls back to
    console output when SMS_API_KEY is not configured (dev).
    """
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


def send_otp_sms(phone_number: str, code: str):
    """Send the OTP via SMS. Email OTP remains the primary channel."""
    message = (
        f"Your VAWC-Response verification code is {code}. "
        f"It expires in {OTP_EXPIRE_MINUTES} minutes. Do not share this code with anyone."
    )
    send_sms(phone_number, message)


def send_otp_email(email: str, code: str, verify_link: str = None):
    try:
        subject = "Your VAWC System Verification Code"

        link_section = ""
        if verify_link:
            link_section = f"""
                <p style="font-size:14px;color:#475569;margin:0 0 14px;line-height:1.6;">
                    You can also verify your account by clicking the button below — in case you closed the verification page:
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                    <tr>
                        <td align="center">
                            <a href="{verify_link}"
                               style="display:inline-block;padding:14px 32px;background-color:#1FA87A;color:#fff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:700;letter-spacing:-0.2px;">
                                Verify My Account
                            </a>
                        </td>
                    </tr>
                </table>
                <p style="text-align:center;font-size:12px;color:#CBD5E1;margin:8px 0 24px;">This link expires in 24 hours.</p>
                <div style="height:1px;background:#F1F5F9;margin:0 0 24px;"></div>
            """

        digits = code

        body = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>VAWC Verification Code</title>
        </head>
        <body style="margin:0;padding:0;background-color:#FBF0F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FBF0F3;padding:32px 16px;">
                <tr>
                    <td align="center">
                        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

                            <!-- Header -->
                            <tr>
                                <td align="center" style="padding-bottom:24px;">
                                    <table cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="background:#fff;border:1px solid #EDADC2;border-radius:12px;padding:10px 14px;vertical-align:middle;">
                                                <span style="font-size:18px;font-weight:800;color:#8B3050;letter-spacing:-0.3px;">VAWC-Response</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Card -->
                            <tr>
                                <td style="background:#fff;border-radius:20px;border:1px solid #EDADC2;padding:36px 32px;box-shadow:0 4px 24px rgba(139,48,80,0.08);">

                                    <!-- Title -->
                                    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#8B3050;">Verify your account</p>
                                    <p style="margin:0 0 28px;font-size:14px;color:#94A3B8;">Barangay Palanginan, Iba, Zambales</p>

                                    <!-- Message -->
                                    <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
                                        Use the verification code below to confirm your account. This code expires in <strong style="color:#8B3050;">5 minutes</strong>.
                                    </p>

                                    <!-- OTP digits -->
                                    <table cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
                                        <tr>
                                            {''.join([f'<td style="padding:0 5px;"><div style="width:42px;height:54px;line-height:54px;text-align:center;background:#FBF0F3;border:2px solid #EDADC2;border-radius:10px;font-size:28px;font-weight:800;color:#C96882;font-family:\'Courier New\',monospace;">{d}</div></td>' for d in code])}
                                        </tr>
                                    </table>
                                    <p style="text-align:center;font-size:12px;color:#CBD5E1;margin:10px 0 28px;">Enter this code in the verification screen</p>

                                    <!-- Divider -->
                                    <div style="height:1px;background:#F1F5F9;margin:0 0 24px;"></div>

                                    {link_section}

                                    <!-- Warning -->
                                    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:14px 16px;margin-top:8px;">
                                        <p style="margin:0;font-size:13px;color:#92400E;line-height:1.6;">
                                            <strong>Did not request this?</strong> You can safely ignore this email. Your account will not be affected.
                                        </p>
                                    </div>

                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td align="center" style="padding-top:24px;">
                                    <p style="margin:0;font-size:12px;color:#CBD5E1;">
                                        VAWC-Response System &nbsp;·&nbsp; Barangay Palanginan, Iba, Zambales<br>
                                        <span style="font-size:11px;">Protected under Republic Act 9262</span>
                                    </p>
                                </td>
                            </tr>

                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.GMAIL_USER
        msg["To"] = email
        msg.attach(MIMEText(body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(settings.GMAIL_USER, settings.GMAIL_APP_PASSWORD)
            server.sendmail(settings.GMAIL_USER, email, msg.as_string())

        print(f"[EMAIL] OTP sent to {email}")

    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send to {email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP email. Please try again.")