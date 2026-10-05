"""Move already-stored incident dates from Manila local time into UTC.

Every timestamp the system generates uses utcnow(), so it is UTC. The incident
date did not: it arrived from the victim's datetime-local picker with no zone on
it and was stored exactly as she typed it, Manila wall-clock. Two frames in one
column set is how a case gets filed on the wrong day and counted in the wrong
month. New reports are converted on the way in now; this shifts the ones already
in the database by the same eight hours.

The same applies to bpos.served_at, which an officer types.

NOT safe to run twice. Each run shifts the values again, so it records what it
did in a marker table and refuses a second pass. If you genuinely need to rerun
after a restore, drop the row it writes to `migration_marks`.

    $env:DATABASE_URL="<connection string>"
    .\\venv\\Scripts\\python.exe migrate_incident_date_utc.py
"""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

MARK = "incident_date_utc_shift"
HOURS = 8

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
    conn.execute(text(
        "CREATE TABLE IF NOT EXISTS migration_marks ("
        " name VARCHAR PRIMARY KEY,"
        " applied_at TIMESTAMP NOT NULL DEFAULT NOW()"
        ")"
    ))
    already = conn.execute(
        text("SELECT applied_at FROM migration_marks WHERE name = :n"), {"n": MARK}
    ).fetchone()

if already:
    raise SystemExit(
        "STOPPED: this shift was already applied on " + str(already[0]) + ".\n"
        "Nothing was changed. Running it twice would move every incident date\n"
        "another eight hours."
    )

with engine.begin() as conn:
    moved = conn.execute(text(
        "UPDATE reports SET incident_date = incident_date - INTERVAL '%d hours' "
        "WHERE incident_date IS NOT NULL" % HOURS
    )).rowcount
    print("  reports.incident_date: " + str(moved) + " shifted.")

    served = conn.execute(text(
        "UPDATE bpos SET served_at = served_at - INTERVAL '%d hours' "
        "WHERE served_at IS NOT NULL" % HOURS
    )).rowcount
    print("  bpos.served_at:        " + str(served) + " shifted.")

    conn.execute(
        text("INSERT INTO migration_marks (name) VALUES (:n)"), {"n": MARK}
    )

print("")
print("Done. Incident dates are now stored in UTC like every other timestamp.")
