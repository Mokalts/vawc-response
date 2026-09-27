"""Add the respondent's address, contact number and age to cases.

Every printed document already asks for these. The BPO reads "<name> of
<address>", and the complaint and Client Card ask for contact and age. Nothing
stored them, so an officer retyped the address on each form and the same case
could leave the desk carrying two different addresses on two documents.

Purely additive: three nullable columns. Existing rows get NULL and every form
behaves exactly as before until an officer fills them in.

Run it with the project's venv Python, not the system one.

    $env:DATABASE_URL="<connection string>"
    .\\venv\\Scripts\\python.exe migrate_respondent_details.py
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

COLUMNS = ["offender_address", "offender_contact", "offender_age"]

with engine.begin() as conn:
    existing = {
        row[0]
        for row in conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'cases'"
        ))
    }
    if not existing:
        raise SystemExit(
            "No 'cases' table found. Check that DATABASE_URL points where you think it does."
        )

    added = 0
    for col in COLUMNS:
        if col in existing:
            print("  " + col + ": already present, skipping.")
            continue
        conn.execute(text("ALTER TABLE cases ADD COLUMN " + col + " VARCHAR"))
        print("  " + col + ": added.")
        added += 1

print("")
print("Done. " + str(added) + " column(s) added.")
