# VAWC-Response — Deployment Guide

This guide deploys the full system for **free** using:

| Component | Host | Free? |
|---|---|---|
| Git repository | **GitHub** | ✅ |
| PostgreSQL database | **Neon** (or Supabase) | ✅ |
| FastAPI backend | **Render** | ✅ (sleeps when idle) |
| Victim + Admin frontends | **Firebase Hosting** (or Vercel) | ✅ |

> The code is already deployment-ready: the frontends read the backend URL from
> `REACT_APP_API_URL`, and the backend reads extra CORS origins from `ALLOWED_ORIGINS`.
> Locally, everything still defaults to `http://localhost`.

---

## ⚠️ Before you start — read this

- **NEVER commit `.env`.** It is already git-ignored. Do not force-add it.
- **NEVER change `ENCRYPTION_KEY`** once real data exists — it decrypts all encrypted
  DB fields. Use the SAME `ENCRYPTION_KEY` value in production as locally, or all
  encrypted data becomes unreadable.
- On a **fresh production database**, the app auto-creates all tables and enum values
  (including `under_process` and the `admin_message` columns) on first startup — you do
  **not** need to run the local migration script.

---

## Step 1 — Push to GitHub

From the `vawc-response` folder:

```bash
git init
git add .
git status                 # confirm .env is NOT listed (it must be ignored)
git commit -m "VAWC-Response initial commit"
```

Create an empty repo on GitHub, then:

```bash
git branch -M main
git remote add origin https://github.com/<your-username>/vawc-response.git
git push -u origin main
```

**Double-check:** run `git ls-files | grep .env` — it should return **nothing** except
`*.env.example` files. If a real `.env` shows up, STOP and remove it before pushing.

---

## Step 2 — Database (Neon)

1. Go to **https://neon.tech** → sign up → **Create Project** (region: Singapore is closest to PH).
2. Copy the **connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxxx.ap-southeast-1.aws.neon.tech/dbname?sslmode=require
   ```
3. Save it — this is your production `DATABASE_URL`.

*(Supabase works too: create project → Settings → Database → Connection string → URI.)*

---

## Step 3 — Backend (Render)

1. Go to **https://render.com** → **New** → **Web Service** → connect your GitHub repo.
2. Configure:
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Free
3. Add **Environment Variables** (from your local `.env` — copy the real values):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | *(the Neon connection string from Step 2)* |
   | `SECRET_KEY` | *(your JWT secret)* |
   | `ALGORITHM` | `HS256` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` |
   | `CLOUDINARY_CLOUD_NAME` | *(your value)* |
   | `CLOUDINARY_API_KEY` | *(your value)* |
   | `CLOUDINARY_API_SECRET` | *(your value)* |
   | `GMAIL_USER` | *(your value)* |
   | `GMAIL_APP_PASSWORD` | *(your value)* |
   | `ENCRYPTION_KEY` | *(EXACT same value as local — do not regenerate)* |
   | `SMS_API_KEY` | *(your Semaphore key)* |
   | `SMS_SENDER` | *(blank, or your registered sender name)* |
   | `ABSTRACT_API_KEY` | *(your value, if used)* |
   | `ALLOWED_ORIGINS` | *(leave blank for now — set in Step 5)* |
   | `PYTHON_VERSION` | `3.12.0` |

4. **Create Web Service.** After it builds, note the URL, e.g.
   `https://vawc-backend.onrender.com`. Visit it — you should see
   `{"message":"VAWC-Response API is running."}`.

> Free Render services **sleep after ~15 min idle** and take ~30–50s to wake on the next
> request. Fine for a demo; mention this to your panel if a first load is slow.

---

## Step 4 — Frontends (Firebase Hosting)

Do this **twice** — once for `victim-frontend`, once for `admin-frontend`.

### 4a. Build with the production backend URL

In each frontend folder, create a file named `.env.production`:

```
REACT_APP_API_URL=https://vawc-backend.onrender.com
```

Then build:

```bash
npm install
npm run build
```

### 4b. Deploy to Firebase

```bash
npm install -g firebase-tools
firebase login
firebase init hosting      # choose "build" as the public directory; configure as SPA (Yes to rewrites)
firebase deploy
```

Firebase gives you a URL like `https://vawc-victim.web.app` and `https://vawc-admin.web.app`.

> **Tip:** Vercel is even simpler for React — import the repo, set the root directory to
> the frontend folder, add `REACT_APP_API_URL` as an env var, and it builds automatically.

---

## Step 5 — Connect frontends to backend (CORS)

Back in **Render → your backend → Environment**, set:

```
ALLOWED_ORIGINS=https://vawc-victim.web.app,https://vawc-admin.web.app
```

(Use your actual deployed frontend URLs, comma-separated, no trailing slash.)
Save — Render redeploys automatically. This lets the browser call the backend.

---

## Step 6 — Test the live system

1. Open the victim site → sign up → check email OTP arrives → log in.
2. Submit a report.
3. Open the admin site → log in (face recognition) → confirm the report appears.
4. Send a message to the victim (Email and/or SMS) → confirm delivery.

---

## Post-deployment notes

- **Semaphore SMS:** works once your account is approved / topped up (buy credits). Until
  then, SMS fails gracefully and email OTP still works.
- **Gmail:** if you lost access to `vawcresponse@gmail.com`, switch `GMAIL_USER` /
  `GMAIL_APP_PASSWORD` to a new Gmail you control (create it, enable 2FA, generate an app
  password) — update the values on Render.
- **Key rotation (optional):** since `.env` was never committed, your keys were never
  exposed. Rotating Cloudinary / JWT / Gmail / AbstractAPI / Semaphore is precautionary.
  **Never rotate `ENCRYPTION_KEY`.**
- **Custom domain (optional):** both Firebase and Render support attaching a custom domain
  for free (you buy the domain separately).
