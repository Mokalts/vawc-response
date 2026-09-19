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
    # OFF until a sender name is approved. Semaphore rejects every send without
    # one, so attempting SMS just delays the caller and drops the message on the
    # floor; with this off, anything that would have been texted goes by email.
    # Flip to true once a sender name shows as Active in the Semaphore account.
    SMS_ENABLED: bool = False

    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""

    # Brevo (HTTP email API) — used in production where SMTP ports are blocked
    # (e.g. Render). When BREVO_API_KEY is set, OTP emails are sent via Brevo's
    # HTTPS API instead of Gmail SMTP. Locally, leave it empty to use SMTP.
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = ""   # Verified sender in Brevo (e.g. vawcresponse1@gmail.com)
    BREVO_SENDER_NAME: str = "VAWC-Response"

    ENCRYPTION_KEY: str = ""  # Fernet key for encrypting report data

    ABSTRACT_API_KEY: str = ""  # AbstractAPI email validation key

    # Where the victim app is hosted. Used to build links inside emails, such as
    # the "Verify my account" button. This must be the deployed site: a localhost
    # default ships emails whose buttons only work on the developer's own machine.
    # Override per environment (set it to http://localhost:3000 for local work).
    FRONTEND_URL: str = "https://vawc-victim-2026.web.app"

    # Euclidean distance below which two face descriptors count as the same
    # person. face-api's own "probably the same" line is 0.6, which sits inside
    # the band where different people also land — that is how someone else's
    # face passed. Tuneable per environment without a code change.
    FACE_MATCH_THRESHOLD: float = 0.45

    # Permanent, unrecoverable deletion of an archived case or victim account.
    # Off by default: during a pilot the cost of an accidental wipe is far higher
    # than the inconvenience of leaving archived rows in place.
    ALLOW_HARD_DELETE: bool = False

    # Emergency way past the face check, for a camera that fails in front of an
    # audience. EMPTY MEANS DISABLED, and it ships empty: with no code set, the
    # endpoint refuses everyone. Set it in the hosting environment shortly before
    # a demo and clear it afterwards. While it is set, anyone holding both an
    # admin password and this code can skip the second factor, so treat it like
    # a password and never commit it.
    FACE_BYPASS_CODE: str = ""

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
