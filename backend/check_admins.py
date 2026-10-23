"""Read-only: who can sign in to the admin portal, and in what state.

A 401 from /admin/auth/login means one of two things and nothing else: there
is no admin with that username, or the password did not match. A deactivated
or deleted account gives 403, and a lockout gives 429. So the first question
is simply whether the account is there at all.

Prints no password material of any kind.
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("DATABASE_URL")
if not url:
    raise SystemExit("DATABASE_URL is not set. Set it for this terminal first.")

host = url.split("@")[-1].split("/")[0]
where = "NEON (production)" if "neon" in host.lower() else host
print("Connecting to: %s  [%s]\n" % (where, host))

engine = create_engine(url)
with engine.connect() as conn:
    rows = conn.execute(text("""
        SELECT username, position, is_super_admin, is_active, is_deleted,
               is_face_enrolled, created_at
        FROM admins
        ORDER BY created_at
    """)).fetchall()

if not rows:
    print("No admin accounts exist at all.")
else:
    print("%-18s %-26s %-6s %-7s %-8s %-6s" % ("USERNAME", "POSITION", "SUPER", "ACTIVE", "DELETED", "FACE"))
    for r in rows:
        print("%-18s %-26s %-6s %-7s %-8s %-6s" % (
            r.username, (r.position or "")[:26], r.is_super_admin,
            r.is_active, r.is_deleted, r.is_face_enrolled))
    print("\n%d account(s)." % len(rows))
