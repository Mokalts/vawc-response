"""Approve accounts that existed before reporting required a verified ID.

The gate was added after these accounts were created, so their owners were
never asked for an ID and never had the chance to send one. Leaving them at
"none" would lock existing users out of reporting because of a rule introduced
after they signed up.

Only verified, non-deleted accounts still at "none" are touched. Anything
already pending, approved or rejected is left exactly as it is.

Safe to run more than once.

    $env:DATABASE_URL="<connection string>"
    .\venv\Scripts\python.exe migrate_grandfather_ids.py
"""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

url = os.getenv("DATABASE_URL")
if not url:
    raise SystemExit("DATABASE_URL is not set. Set it for this terminal first.")


def _target() -> str:
    host = url.split("@")[-1].split("/")[0]
    if "neon" in host.lower():
        return "NEON (production)  [" + host + "]"
    if "localhost" in host or "127.0.0.1" in host:
        return "LOCAL (your laptop)  [" + host + "]"
    return host


print("Connecting to: " + _target())
engine = create_engine(url)

with engine.begin() as conn:
    n = conn.execute(text(
        "UPDATE users SET id_status = 'approved',"
        " id_reviewed_by = 'Existing account, before ID checks began',"
        " id_reviewed_at = NOW()"
        " WHERE id_status = 'none' AND is_verified = TRUE AND is_deleted = FALSE"
    )).rowcount

print("  " + str(n) + " existing account(s) approved.")
print("")
print("Done. Accounts created from now on must send an ID before they can report.")
