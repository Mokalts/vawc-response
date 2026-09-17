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