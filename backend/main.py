from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import engine, get_db
from core.progressive_limiter import client_ip
from models import User, Report, OTP
from models.case import Case
from models.case_message import CaseMessage
from models.case_activity import CaseActivity
from models.deletion_record import DeletionRecord
from models.admin import Admin
# New lawful-flow models — imported so create_all registers their tables.
from models.bpo import BPO
from models.child import Child
from models.endorsement import Endorsement
from models.barangay_official import BarangayOfficial
from database import Base
from routers import auth, reports, cases, users, upload, admin_auth, admin_cases, admin_dashboard, admin_users
from routers import admin_bpo, admin_endorsement, admin_officials, admin_history, media

# Creating tables must not be able to stop the app from starting. Neon suspends
# a free database after idle time, so a Render restart can land while the
# database is still waking; raising here turned that into a failed boot and a
# dead service. Tables already exist in every deployed environment, so logging
# and carrying on is right: the first real query wakes the database and, if
# something is genuinely wrong, it surfaces as a normal request error.
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:  # noqa: BLE001 — deliberately broad, boot must survive
    print(f"[STARTUP] create_all skipped: {type(e).__name__}: {e}")

# Bootstrap the first super admin from env vars (no-op once one exists).
from seed import seed_super_admin
seed_super_admin()

# Keyed on the caller's own address, not slowapi's get_remote_address. That
# returns request.client.host, which behind Render's proxy is the proxy itself
# and therefore identical for every user on the internet: "12 registrations an
# hour" then meant twelve for the whole barangay, and one tester's signups
# locked out the next person in the queue. client_ip reads the forwarded address
# the way the login lockout already did.
limiter = Limiter(key_func=client_ip)

from core.config import settings as _settings

# Whether this is a deployed environment, decided the same way CORS decides it:
# real origins configured means production. Locally the docs stay on, because
# browsing them is how you work on the thing.
_IS_DEPLOYED = bool((_settings.ALLOWED_ORIGINS or "").strip())
_DOCS_ON = _settings.ENABLE_DOCS or not _IS_DEPLOYED

app = FastAPI(
    title="VAWC-Response API",
    description="Backend API for the VAWC Reporting and Monitoring System",
    version="1.0.0",
    docs_url="/docs" if _DOCS_ON else None,
    redoc_url="/redoc" if _DOCS_ON else None,
    openapi_url="/openapi.json" if _DOCS_ON else None,
)

# ── What this instance is running with ───────────────────────────────────────
# Printed once, loudly, because two of these are meant to be temporary and a
# temporary setting nobody is reminded of is a permanent one.
if _IS_DEPLOYED and _DOCS_ON:
    print("[CONFIG] WARNING: API docs are OPEN on a deployed instance. "
          "Clear ENABLE_DOCS when you have finished.")

if (_settings.FACE_BYPASS_CODE or "").strip():
    print("[CONFIG] WARNING: FACE_BYPASS_CODE is SET. Any admin holding it can "
          "skip the face check with only a password. This is for a demo. "
          "Clear it afterwards.")

if not (_settings.ENCRYPTION_KEY or "").strip():
    print("[CONFIG] WARNING: ENCRYPTION_KEY is empty. Anything that should be "
          "encrypted at rest will not be.")

if _settings.ALLOW_HARD_DELETE:
    print("[CONFIG] NOTE: permanent case deletion is enabled.")


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allowed CORS origins: localhost defaults for dev + any production origins
# supplied via the ALLOWED_ORIGINS setting (comma-separated, from .env or OS env).
settings = _settings
_DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
]
_EXTRA_ORIGINS = [o.strip() for o in (settings.ALLOWED_ORIGINS or "").split(",") if o.strip()]
# Once real origins are configured, this is a deployed environment and the
# localhost entries have no business being accepted with credentials.
ALLOWED_ORIGINS = _EXTRA_ORIGINS if _EXTRA_ORIGINS else _DEFAULT_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(reports.router)
app.include_router(upload.router)
app.include_router(media.router)
app.include_router(users.router)
app.include_router(admin_auth.router)
app.include_router(admin_dashboard.router)
app.include_router(cases.router)
app.include_router(admin_cases.router)
app.include_router(admin_users.router)
# Unhandled errors bypass the CORS middleware, so the browser reports them as an
# opaque CORS/network failure instead of a 500. Return JSON with the CORS headers
# attached so the frontend can show the real problem.
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()   # shows up in the Render logs
    headers = {}
    origin = request.headers.get("origin")
    if origin and origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    return JSONResponse(
        status_code=500,
        content={"detail": "A server error occurred while processing your request. Please try again."},
        headers=headers,
    )


app.include_router(admin_bpo.router)
app.include_router(admin_endorsement.router)
app.include_router(admin_officials.router)
app.include_router(admin_history.router)

# Accept both GET and HEAD so uptime monitors (which use HEAD by default) get a
# 200 instead of a 405 — keeps the free instance awake without false "down" alerts.
@app.api_route("/", methods=["GET", "HEAD"], tags=["Health"])
def root():
    return {"message": "VAWC-Response API is running."}


# Keep-warm endpoint that ALSO touches the database. Rate limited despite being
# trivial: it is the one public route that reaches Postgres, and on a free Neon
# plan compute is the budget. A monitor polling it too often is what took this
# system down once already, and anyone can poll it.
# Keep-warm endpoint that ALSO touches the database. Point the uptime monitor
# here (instead of "/") so the free-tier Postgres (Neon) stays awake too — not
# just the web server. This prevents a slow first login when the DB has
# auto-suspended after inactivity. Accepts HEAD so uptime monitors get a 200.
@app.api_route("/health/db", methods=["GET", "HEAD"], tags=["Health"])
@limiter.limit("30/minute")
def health_db(request: Request, db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "up"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "error", "db": "down"})