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


# ── Text messaging ───────────────────────────────────────────────────────────
# Two providers, because the Philippine carriers forced the choice.
#
# Globe and Smart require an A2P sender ID to be pre-registered, and drop or
# overwrite anything sent without one. That is a carrier rule, not a vendor
# policy, so every hosted gateway (Semaphore, Brevo, Vonage, PhilSMS) asks for
# the same registration before a single message moves. A barangay capstone with
# no registered sender therefore cannot send on that route at all.
#
# textbee sidesteps it by not being on that route: an Android handset with an
# ordinary SIM acts as the gateway, so the text leaves as person-to-person
# traffic and no A2P registration applies. For this system that is arguably the
# better fit anyway. The barangay already has a phone, and a code arriving from
# a number she can reply to is worth more to a victim than one from an
# unreplyable shortcode.
#
# Its costs are real and worth naming in the manuscript: the handset has to stay
# powered and online, the free tier allows 300 messages a month and 50 a day
# (received ones included), and on the hosted service the message text passes
# through a third party, which is why only OTP codes and status notices are sent
# this way and never any part of a statement.
SEMAPHORE_URL = "https://api.semaphore.co/api/v4/messages"
TEXTBEE_BASE = "https://api.textbee.dev/api/v1/gateway"


def _normalize_ph_number(phone: str) -> str:
    """A Philippine mobile number as Semaphore wants it: 09xxxxxxxxx."""
    d = "".join(ch for ch in (phone or "") if ch.isdigit())
    if d.startswith("63") and len(d) == 12:      # 639171234567
        return d
    if d.startswith("0") and len(d) == 11:       # 09171234567
        return d
    if len(d) == 10 and d.startswith("9"):       # 9171234567 -> 09171234567
        return "0" + d
    return d or (phone or "")


def _e164_ph(phone: str) -> str:
    """The same number as E.164: +639xxxxxxxxx.

    textbee hands the number to Android's own SMS stack, which treats a bare
    09xxxxxxxxx as local and usually gets it right. "Usually" is not good enough
    for a verification code, so the country code is made explicit here.
    """
    d = "".join(ch for ch in (phone or "") if ch.isdigit())
    if d.startswith("63") and len(d) == 12:
        return "+" + d
    if d.startswith("0") and len(d) == 11:
        return "+63" + d[1:]
    if len(d) == 10 and d.startswith("9"):
        return "+63" + d
    if d:
        return "+" + d
    return phone or ""


def _provider() -> str:
    return (getattr(settings, "SMS_PROVIDER", "") or "textbee").strip().lower()


def _provider_key() -> str:
    """The API key belonging to whichever provider is selected."""
    if _provider() == "semaphore":
        return (getattr(settings, "SMS_API_KEY", "") or "").strip()
    return (getattr(settings, "TEXTBEE_API_KEY", "") or "").strip()


def sms_enabled() -> bool:
    """Whether SMS is worth attempting at all.

    Needs both the selected provider's key and the explicit switch. The switch
    is separate on purpose: a key can be perfectly valid while every send still
    fails for a reason this code cannot see, such as an unregistered sender name
    or a gateway handset that is switched off. With the switch down, anything
    that would have been texted goes by email instead of being dropped.
    """
    return bool(getattr(settings, "SMS_ENABLED", False)) and bool(_provider_key())


def _send_via_semaphore(api_key: str, phone_number: str, message: str) -> bool:
    payload = {
        "apikey": api_key,
        "number": _normalize_ph_number(phone_number),
        "message": message,
        # Semaphore requires an active sender name; "SEMAPHORE" is its own,
        # which is accepted on any account and needs no registration.
        "sendername": (getattr(settings, "SMS_SENDER", "") or "").strip() or "SEMAPHORE",
    }
    resp = requests.post(SEMAPHORE_URL, data=payload, timeout=15)
    if resp.status_code in (200, 201):
        return True
    print(f"[SMS] Semaphore error {resp.status_code}: {resp.text[:300]}")
    return False


def _send_via_textbee(api_key: str, phone_number: str, message: str) -> bool:
    """Post to textbee, which relays through the barangay's Android handset.

    Two URL shapes are in use: an account-level one that routes to whichever
    device the key owns, and a device-scoped one. Setting TEXTBEE_DEVICE_ID
    picks the second, which is what you want once more than one handset is
    enrolled, since otherwise the choice of phone is the service's to make.
    """
    device = (getattr(settings, "TEXTBEE_DEVICE_ID", "") or "").strip()
    url = f"{TEXTBEE_BASE}/devices/{device}/send-sms" if device else f"{TEXTBEE_BASE}/send-sms"

    body = {"recipients": [_e164_ph(phone_number)], "message": message}

    # Which SIM sends it, on a handset with two.
    #
    # Android will not pick for you: with two SIMs and no default SMS
    # subscription it refuses the send outright, reporting it as
    # RESULT_NO_DEFAULT_SMS_APP even when a messaging app is set. Worse, some
    # builds have no setting for a default SMS SIM at all, HyperOS 3 among them,
    # so there is nowhere on the phone to answer the question.
    #
    # Setting this answers it from here instead. It is the SIM's subscription
    # id, which the textbee app shows on its Dashboard, and NOT the slot number.
    # Left empty, the phone falls back to the default SIM chosen in the app.
    sim = str(getattr(settings, "TEXTBEE_SIM_ID", "") or "").strip()
    if sim:
        try:
            body["simSubscriptionId"] = int(sim)
        except ValueError:
            # A wrong id is ignored by the phone, which then sends from whichever
            # SIM it likes. Saying so beats a message leaving on the wrong number.
            print(f"[SMS] TEXTBEE_SIM_ID {sim!r} is not a number; letting the app default decide.")

    resp = requests.post(
        url,
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json=body,
        timeout=20,
    )
    if resp.status_code in (200, 201):
        return True
    # 401/403 is the key, 404 a wrong device id, 429 the free tier's daily cap,
    # and a 400 mentioning the device usually means the handset is offline.
    print(f"[SMS] textbee error {resp.status_code}: {resp.text[:300]}")
    return False


def send_sms(phone_number: str, message: str) -> bool:
    """Send one text message. Returns True only if the provider accepted it.

    Never raises. Every caller treats SMS as the nice-to-have half of a pair and
    falls back to email, so an exception escaping here would break a login over
    a message that was never essential.

    True means accepted for delivery, not delivered. With textbee the handset
    still has to have signal and credit, which this code cannot see.
    """
    if not sms_enabled():
        print(f"[SMS] skipped for {phone_number}: SMS is switched off.")
        return False

    api_key = _provider_key()
    if not api_key:
        print(f"[DEV] SMS to {phone_number}: {message}  (no provider key set, SMS skipped)")
        return False

    provider = _provider()
    try:
        if provider == "semaphore":
            ok = _send_via_semaphore(api_key, phone_number, message)
        elif provider == "textbee":
            ok = _send_via_textbee(api_key, phone_number, message)
        else:
            print(f"[SMS] unknown SMS_PROVIDER {provider!r}; expected textbee or semaphore.")
            return False
        if ok:
            print(f"[SMS] sent to {phone_number} via {provider}.")
        return ok
    except Exception as e:  # noqa: BLE001
        print(f"[SMS] failed to send via {provider}: {e}")
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
        if resp.status_code == 401:
            # Brevo's "Authorised IPs" setting rejects calls from an address it
            # has not seen before, and Render gives the service a new outbound
            # address whenever the instance moves. Nothing in the code changes;
            # every email simply stops until the address is authorised, or the
            # setting is turned off.
            print("[EMAIL] Brevo rejected the API key for this server. Check the "
                  "Authorised IPs setting in Brevo (Account > Security) and the key in Render.")
        raise HTTPException(status_code=500, detail="Failed to send OTP email. Please try again.")
    print(f"[EMAIL] OTP sent to {to_email} via Brevo.")