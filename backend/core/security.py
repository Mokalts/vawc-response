from datetime import datetime, timedelta
import hashlib
from jose import JWTError, jwt
from passlib.context import CryptContext
from core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def create_verify_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(hours=24)
    data = {"sub": str(user_id), "type": "email_verify", "exp": expire}
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_verify_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "email_verify":
            return None
        return int(payload.get("sub"))
    except JWTError:
        return None


# ── Password reset ────────────────────────────────────────────────────────────
# Proof that the OTP step actually happened. The reset endpoint used to take an
# email or phone number and a new password, with nothing tying it to the code
# that was sent, so anyone could set any account's password. Short-lived on
# purpose: it is handed over seconds before it is used.
RESET_TOKEN_MINUTES = 10


def password_fingerprint(password_hash: str) -> str:
    """A short, non-reversible marker of the password a token was issued against.

    Carrying it in the token makes the token single-use without a database
    column: the moment the password changes, the fingerprint no longer matches
    and the token is dead. It also kills any token still outstanding when the
    password is changed some other way.
    """
    return hashlib.sha256((password_hash or "").encode()).hexdigest()[:16]


def create_reset_token(user_id: int, pw_fingerprint: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_MINUTES)
    data = {"sub": str(user_id), "type": "pw_reset", "pwf": pw_fingerprint, "exp": expire}
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_reset_token(token: str) -> tuple[int | None, str | None]:
    """Returns (user_id, password_fingerprint), or (None, None) if unusable."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "pw_reset":
            return None, None
        return int(payload.get("sub")), payload.get("pwf")
    except (JWTError, TypeError, ValueError):
        return None, None


# ── Media tokens ──────────────────────────────────────────────────────────────
# A browser cannot send an Authorization header on an <img src>, and the apps
# sit on a different origin from the api, so a cookie will not reliably ride
# along either. The serializer therefore hands out a link carrying a short-lived
# token that names exactly one image.
#
# This is what makes evidence photographs private. Cloudinary assets are
# uploaded as authenticated and their signed links never leave this server;
# everything a browser sees expires. A link copied out of the page, or left in
# someone's history, is worthless within the hour.
MEDIA_TOKEN_MINUTES = 30


def create_media_token(ref: str) -> str:
    """`ref` identifies one image, e.g. "report:12:0" or "id:7"."""
    expire = datetime.utcnow() + timedelta(minutes=MEDIA_TOKEN_MINUTES)
    return jwt.encode({"ref": ref, "type": "media", "exp": expire},
                      settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_media_token(token: str):
    """Return the ref this token permits, or None if it is invalid or expired."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except Exception:
        return None
    if payload.get("type") != "media":
        return None
    return payload.get("ref")


# ── ID submission tokens ─────────────────────────────────────────────────────
# Sign-in is refused until a barangay officer approves her ID, so she cannot
# reach the upload screen the normal way. Without something like this a rejected
# ID would strand the account for good: no session, therefore no way to send
# another, therefore no way ever to be approved.
#
# This token is minted only after she has proved her password at sign-in, lasts
# half an hour, and opens exactly one door: submitting an ID. It is not a
# session, and get_current_user refuses it, so it cannot read a case or a
# profile.
ID_SUBMIT_TOKEN_MINUTES = 30


def create_id_submit_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ID_SUBMIT_TOKEN_MINUTES)
    return jwt.encode({"sub": str(user_id), "type": "id_submit", "exp": expire},
                      settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_id_submit_token(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except Exception:
        return None
    if payload.get("type") != "id_submit":
        return None
    return payload.get("sub")
