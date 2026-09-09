from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import engine, get_db
from models import User, Report, OTP
from models.case import Case
from models.case_message import CaseMessage
from models.admin import Admin
# New lawful-flow models — imported so create_all registers their tables.
from models.bpo import BPO
from models.child import Child
from models.endorsement import Endorsement
from models.barangay_official import BarangayOfficial
from database import Base
from routers import auth, reports, cases, users, upload, admin_auth, admin_cases, admin_dashboard, admin_users
from routers import admin_bpo, admin_endorsement, admin_officials

Base.metadata.create_all(bind=engine)

# Bootstrap the first super admin from env vars (no-op once one exists).
from seed import seed_super_admin
seed_super_admin()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="VAWC-Response API",
    description="Backend API for the VAWC Reporting and Monitoring System",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allowed CORS origins: localhost defaults for dev + any production origins
# supplied via the ALLOWED_ORIGINS setting (comma-separated, from .env or OS env).
from core.config import settings
_DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
]
_EXTRA_ORIGINS = [o.strip() for o in (settings.ALLOWED_ORIGINS or "").split(",") if o.strip()]
ALLOWED_ORIGINS = _DEFAULT_ORIGINS + _EXTRA_ORIGINS

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

# Accept both GET and HEAD so uptime monitors (which use HEAD by default) get a
# 200 instead of a 405 — keeps the free instance awake without false "down" alerts.
@app.api_route("/", methods=["GET", "HEAD"], tags=["Health"])
def root():
    return {"message": "VAWC-Response API is running."}


# Keep-warm endpoint that ALSO touches the database. Point the uptime monitor
# here (instead of "/") so the free-tier Postgres (Neon) stays awake too — not
# just the web server. This prevents a slow first login when the DB has
# auto-suspended after inactivity. Accepts HEAD so uptime monitors get a 200.
@app.api_route("/health/db", methods=["GET", "HEAD"], tags=["Health"])
def health_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "up"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "error", "db": "down"})