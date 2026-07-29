# VAWC-Response Backend

FastAPI backend for the VAWC Reporting and Monitoring System.

---

## Folder Structure

```
backend/
├── main.py                  ← App entry point
├── database.py              ← SQLAlchemy engine + session
├── requirements.txt
├── .env                     ← Your secrets (copy from .env.example)
├── core/
│   ├── config.py            ← Reads .env settings
│   ├── security.py          ← JWT + password hashing
│   └── dependencies.py      ← get_current_user dependency
├── models/
│   ├── user.py              ← Users table
│   ├── report.py            ← Reports table + ReportStatus enum
│   └── otp.py               ← OTPs table
├── schemas/
│   ├── user.py              ← Pydantic schemas for user
│   ├── report.py            ← Pydantic schemas for report
│   └── otp.py               ← Pydantic schemas for OTP
├── routers/
│   ├── auth.py              ← /auth/* (register, login, otp)
│   ├── reports.py           ← /reports/* (submit, list, detail)
│   ├── upload.py            ← /upload/image (Cloudinary)
│   └── users.py             ← /users/me (profile)
└── utils/
    ├── otp_helper.py        ← OTP generation + SMS stub
    └── cloudinary_helper.py ← Cloudinary upload wrapper
```

---

## Setup

### 1. Create and activate a virtual environment
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Create your .env file
```bash
copy .env.example .env   # Windows
cp .env.example .env     # Mac/Linux
```
Then fill in your values in `.env`:
- `DATABASE_URL` — your PostgreSQL connection string
- `SECRET_KEY` — any long random string
- `CLOUDINARY_*` — from your Cloudinary dashboard

### 4. Make sure PostgreSQL is running
Create the database manually once:
```sql
CREATE DATABASE vawc_response;
```

### 5. Run the server
```bash
uvicorn main:app --reload
```

Server runs at: **http://localhost:8000**

---

## API Docs

Once running, open your browser:
- Swagger UI: http://localhost:8000/docs
- ReDoc:       http://localhost:8000/redoc

---

## API Endpoints

| Method | Endpoint              | Auth | Description                  |
|--------|-----------------------|------|------------------------------|
| POST   | /auth/register        | No   | Register new user            |
| POST   | /auth/login           | No   | Login, get JWT token         |
| POST   | /auth/otp/send        | No   | Send OTP to phone            |
| POST   | /auth/otp/verify      | No   | Verify OTP, activate account |
| GET    | /users/me             | Yes  | Get current user profile     |
| PATCH  | /users/me             | Yes  | Update profile               |
| POST   | /reports/             | Yes  | Submit a new report          |
| GET    | /reports/             | Yes  | Get my reports               |
| GET    | /reports/{id}         | Yes  | Get report detail            |
| POST   | /upload/image         | Yes  | Upload photo to Cloudinary   |

---

## Report Status Flow

```
Submitted → Pending Confirmation → Confirmed →
Under Review → Referred to Authorities → Action Taken → Resolved
```

---

## Notes

- OTP SMS is a stub for now (`utils/otp_helper.py`). During dev, the OTP prints to your terminal.
- Tables are auto-created on startup via `Base.metadata.create_all()`.
- JWT tokens expire after 60 minutes (configurable in `.env`).
