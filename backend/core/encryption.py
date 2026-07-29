import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

_key = os.getenv("ENCRYPTION_KEY")
if not _key:
    raise RuntimeError("ENCRYPTION_KEY is missing from .env")

_fernet = Fernet(_key.encode())


def encrypt(value: str) -> str:
    """Encrypt a string — returns a base64 token string."""
    if value is None:
        return None
    return _fernet.encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    """Decrypt a base64 token string — returns the original string."""
    if token is None:
        return None
    try:
        return _fernet.decrypt(token.encode()).decode()
    except Exception:
        # If decryption fails it means the value is old plain text — return as-is
        return token


def encrypt_float(value: float) -> str:
    """Encrypt a float (lat/lng) — converts to string first."""
    if value is None:
        return None
    return encrypt(str(value))


def decrypt_float(token: str) -> float:
    """Decrypt back to float."""
    if token is None:
        return None
    try:
        return float(decrypt(token))
    except Exception:
        try:
            return float(token)  # Old plain float value — return as-is
        except Exception:
            return None