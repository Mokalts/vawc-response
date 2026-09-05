"""
One-off cleanup of test/junk victim accounts created during debugging.

Deletes users whose email ends with @example.com (the probe accounts used while
fixing the deployment), along with their OTP rows. These are unverified and have
no real cases, so removal is safe.

USAGE (run against the LIVE Neon database):

  Windows PowerShell — point DATABASE_URL at your Neon connection string just for
  this run, then execute with the backend venv:

    $env:DATABASE_URL = "<your-neon-connection-string>"
    venv\Scripts\python.exe cleanup_test_data.py

  It prints what it will delete and asks for confirmation before committing.
"""
from database import SessionLocal, engine
from models.user import User
from models.otp import OTP


def main():
    print(f"[cleanup] Connected to: {engine.url.host}")
    db = SessionLocal()
    try:
        test_users = db.query(User).filter(User.email.ilike("%@example.com")).all()

        if not test_users:
            print("[cleanup] No @example.com test users found. Nothing to do.")
            return

        print(f"[cleanup] Found {len(test_users)} test user(s):")
        for u in test_users:
            print(f"    - id={u.id}  {u.email}  ({u.phone_number})  verified={u.is_verified}")

        confirm = input("\nDelete these users and their OTPs? Type 'yes' to proceed: ").strip().lower()
        if confirm != "yes":
            print("[cleanup] Aborted. Nothing was deleted.")
            return

        deleted = 0
        for u in test_users:
            db.query(OTP).filter(OTP.user_id == u.id).delete()
            db.delete(u)
            deleted += 1
        db.commit()
        print(f"[cleanup] Done. Deleted {deleted} test user(s) and their OTPs.")
    except Exception as e:
        db.rollback()
        print(f"[cleanup] Error (nothing committed): {e}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
