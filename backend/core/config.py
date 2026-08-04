from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    SMS_API_KEY: str = ""
    SMS_SENDER: str = ""

    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""

    ENCRYPTION_KEY: str = ""  # Fernet key for encrypting report data

    ABSTRACT_API_KEY: str = ""  # AbstractAPI email validation key

    # Extra CORS origins for production (comma-separated). localhost is always allowed.
    ALLOWED_ORIGINS: str = ""

    # Auth cookie settings. For a cross-site setup (frontend on a different domain
    # than the API, e.g. *.web.app + *.onrender.com) the browser only sends the
    # cookie when SameSite=None AND Secure=True (HTTPS). Locally, keep the defaults
    # (lax / not-secure) so cookies work over http://localhost.
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"   # "lax" for local dev, "none" for cross-site prod

    # One-time super admin seed (only used if NO super admin exists yet).
    # Set these as environment variables in production to bootstrap the first
    # account, then they are ignored on subsequent startups.
    SEED_SUPERADMIN_USERNAME: str = ""
    SEED_SUPERADMIN_PASSWORD: str = ""
    SEED_SUPERADMIN_EMAIL: str = ""
    SEED_SUPERADMIN_PHONE: str = ""
    SEED_SUPERADMIN_FIRSTNAME: str = "Super"
    SEED_SUPERADMIN_LASTNAME: str = "Admin"

    class Config:
        env_file = ".env"


settings = Settings()
