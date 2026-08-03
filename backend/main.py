from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from database import engine
from models import User, Report, OTP
from models.case import Case
from models.case_message import CaseMessage
from models.admin import Admin
from database import Base
from routers import auth, reports, cases, users, upload, admin_auth, admin_cases, admin_dashboard, admin_users

Base.metadata.create_all(bind=engine)

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

@app.get("/", tags=["Health"])
def root():
    return {"message": "VAWC-Response API is running."}