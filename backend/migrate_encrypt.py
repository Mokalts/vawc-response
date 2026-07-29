import sys, os
sys.path.append(os.path.dirname(__file__))

from database import SessionLocal
from models.report import Report
from core.encryption import encrypt, encrypt_float, decrypt

db = SessionLocal()
reports = db.query(Report).all()
count = 0

for r in reports:
    changed = False

    # Encrypt statement if not already encrypted
    if r.statement and not r.statement.startswith("gAAA"):
        r.statement = encrypt(r.statement)
        changed = True

    # Encrypt latitude if it looks like a plain float string
    if r.latitude:
        try:
            float(r.latitude)  # If this works, it's still plain text
            r.latitude = encrypt_float(float(r.latitude))
            changed = True
        except Exception:
            pass  # Already encrypted

    # Encrypt longitude if it looks like a plain float string
    if r.longitude:
        try:
            float(r.longitude)
            r.longitude = encrypt_float(float(r.longitude))
            changed = True
        except Exception:
            pass  # Already encrypted

    if changed:
        count += 1

db.commit()
db.close()
print(f"Migration complete — {count} report(s) encrypted.")