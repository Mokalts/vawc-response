"""
One-time bootstrap for the first Super Admin account.

On startup, if there is NO super admin in the database yet AND the
SEED_SUPERADMIN_* environment variables are set, this creates the initial
super admin. Once a super admin exists, this does nothing on future startups,
so it is safe to leave the env vars in place.
"""
from sqlalchemy.orm import Session
from database import SessionLocal
from models.admin import Admin
from core.security import hash_password
from core.config import settings


def seed_super_admin():
    username = (settings.SEED_SUPERADMIN_USERNAME or "").strip()
    password = settings.SEED_SUPERADMIN_PASSWORD or ""
    email = (settings.SEED_SUPERADMIN_EMAIL or "").strip()
    phone = (settings.SEED_SUPERADMIN_PHONE or "").strip()

    # Nothing to do if the seed env vars are not configured.
    if not (username and password and email and phone):
        return

    db: Session = SessionLocal()
    try:
        # Already have a super admin? Do nothing.
        if db.query(Admin).filter(Admin.is_super_admin == True).first():
            return

        # Avoid clashing with an existing (non-super) account.
        if db.query(Admin).filter(Admin.username == username).first():
            print(f"[seed] Username '{username}' already exists — skipping super admin seed.")
            return

        admin = Admin(
            first_name=(settings.SEED_SUPERADMIN_FIRSTNAME or "Super").strip(),
            last_name=(settings.SEED_SUPERADMIN_LASTNAME or "Admin").strip(),
            email=email,
            phone_number=phone,
            employee_id="EMP-000",
            username=username,
            position="Super Admin",
            is_super_admin=True,
            password_hash=hash_password(password),
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"[seed] Super admin '{username}' created successfully.")
    except Exception as e:
        db.rollback()
        print(f"[seed] Failed to seed super admin: {e}")
    finally:
        db.close()
