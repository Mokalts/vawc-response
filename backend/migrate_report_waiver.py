r"""
Add the mandatory-report waiver columns to an existing database.

Handbook p.29 makes the four-hour report to the PNP and C/MSWDO a standard step,
and p.30 requires the victim-survivor's informed consent before a referral is
made — which covers that report. A desk that respects a refusal had nowhere to
say so, and the case stayed flagged overdue for ever. These columns record why
an office was not told.

Safe to run more than once; existing rows keep NULL, meaning "no decision yet".

    cd backend
    $env:DATABASE_URL="<neon connection string>"   # PowerShell
    py -3 migrate_report_waiver.py
"""
import sys
from sqlalchemy import text
from database import engine

COLUMNS = {
    "pnp_report_waived_reason":   "VARCHAR(160)",
    "mswdo_report_waived_reason": "VARCHAR(160)",
}


def _target() -> str:
    """Host and database name only, so the password never reaches the screen."""
    import re, os
    url = os.environ.get("DATABASE_URL", "") or str(engine.url)
    host = re.sub(r"^.*@", "", url).split("/")[0]
    name = url.rsplit("/", 1)[-1].split("?")[0]
    where = "NEON (production)" if "neon" in host.lower() else (
        "LOCAL (your laptop)" if "localhost" in host or "127.0.0.1" in host else "unrecognised host")
    return f"{host}/{name}  ->  {where}"


def main():
    print("Connecting to: " + _target())
    print()
    with engine.begin() as conn:
        existing = {
            r[0] for r in conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'cases'"
            ))
        }
        if not existing:
            print("No 'cases' table found. Is DATABASE_URL pointing at the right database?")
            return 1

        added = 0
        for col, coltype in COLUMNS.items():
            if col in existing:
                print(f"  {col}: already present, skipping")
                continue
            conn.execute(text(f"ALTER TABLE cases ADD COLUMN {col} {coltype}"))
            print(f"  {col}: added")
            added += 1

    print(f"\nDone. {added} column(s) added.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
