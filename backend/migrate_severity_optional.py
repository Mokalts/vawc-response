r"""
Make cases.severity nullable, because the application no longer sets it.

Severity/triage was removed from the system: it had no counterpart in the
Barangay VAW Desk Handbook or in any paper form the desk uses, and nothing
downstream consumed it. The column is NOT NULL with no database-side default,
so once the code stops supplying a value every new case INSERT would fail.
Dropping the constraint keeps existing values intact and lets new cases omit it.

RUN THIS BEFORE DEPLOYING the code that removes severity.

    cd backend
    $env:DATABASE_URL="<neon connection string>"
    .\venv\Scripts\python.exe migrate_severity_optional.py

Safe to run more than once.
"""
import os
import re
import sys

from sqlalchemy import text

from database import engine


def _target() -> str:
    """Host and database name only, so the password never reaches the screen."""
    url = os.environ.get("DATABASE_URL", "") or str(engine.url)
    host = re.sub(r"^.*@", "", url).split("/")[0]
    name = url.rsplit("/", 1)[-1].split("?")[0]
    where = "NEON (production)" if "neon" in host.lower() else (
        "LOCAL (your laptop)" if "localhost" in host or "127.0.0.1" in host else "unrecognised host")
    return f"{host}/{name}  ->  {where}"


def main() -> int:
    print("Connecting to: " + _target())
    print()

    with engine.begin() as conn:
        row = conn.execute(text(
            "SELECT is_nullable FROM information_schema.columns "
            "WHERE table_name = 'cases' AND column_name = 'severity'"
        )).fetchone()

        if row is None:
            print("  severity: column not present — nothing to do.")
            return 0
        if row[0] == "YES":
            print("  severity: already nullable, skipping")
            return 0

        conn.execute(text("ALTER TABLE cases ALTER COLUMN severity DROP NOT NULL"))
        print("  severity: NOT NULL dropped (existing values kept)")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
