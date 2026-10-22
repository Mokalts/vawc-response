"""Create the hotlines table and seed it from the list in the app.

The emergency numbers were a constant in the victim app, so correcting one
meant a code change and two deploys. The desk is who learns that a line has
moved, so this moves the list into the database where the desk can edit it.

Seeded with exactly what the app shows today, so nothing changes the moment
this runs - the panel keeps displaying what it displayed before, and the
officers can then correct it from Admin Management.

Two seeded entries are deliberately marked for attention:

  - "DSWD Hotline 1343" is mislabelled. 1343 is the Actionline Against Human
    Trafficking, run by the Commission on Filipinos Overseas with IACAT, not a
    DSWD line and not for VAWC. Its description says so now, so an officer
    reading the list can decide whether to keep or replace it.
  - The test number is seeded inactive, so it stops showing in the app but is
    still there if it is wanted back.

Safe to run more than once: it only seeds when the table is empty.

Run it with the project's venv Python, not the system one.
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

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
IS_SQLITE = url.startswith("sqlite")

# label, dial, display, description, critical, test, active, order
SEED = [
    ("PNP Emergency", "911", "911",
     "Police response for Iba, Zambales and nationwide.", True, False, True, 10),
    ("Barangay Palanginan VAWC Desk", "+639286673772", "0928 667 3772",
     "Ms. Maria Theresa M. De Leon, Admin Assistant.", False, False, True, 20),
    ("Public Attorney's Office", "+63289299436", "(02) 8929-9436",
     "Free legal assistance. NOTE: this is the Manila head office - replace it "
     "with the PAO district office at the Bulwagan ng Katarungan, Iba.",
     False, False, True, 30),
    ("PNP Women & Children Desk", None, "1800-188-PNP-107",
     "VAWC case handling, nationwide. NOTE: unverified - the WCPC publishes "
     "Aleng Pulis on mobile numbers instead. Confirm before relying on it.",
     False, False, True, 40),
    ("1343 Actionline", "1343", "1343",
     "Human trafficking, 24/7. NOT a VAWC line: it is run by the Commission on "
     "Filipinos Overseas with IACAT. Replace with a DSWD number if VAWC "
     "referral is what is wanted here.", False, False, True, 50),
    ("Test Number", "+639085267335", "0908 526 7335",
     "System testing only. This is not an official hotline.", False, True, False, 900),
]


def table_exists(conn, table):
    if IS_SQLITE:
        row = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = :t"
        ), {"t": table}).fetchone()
        return row is not None
    row = conn.execute(text("SELECT to_regclass(:t)"), {"t": "public." + table}).fetchone()
    return row is not None and row[0] is not None


with engine.begin() as conn:
    if table_exists(conn, "hotlines"):
        print("  hotlines: table already exists")
    else:
        if IS_SQLITE:
            conn.execute(text("""
                CREATE TABLE hotlines (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    label       VARCHAR NOT NULL,
                    dial        VARCHAR,
                    display     VARCHAR NOT NULL,
                    description VARCHAR,
                    is_critical BOOLEAN NOT NULL DEFAULT 0,
                    is_test     BOOLEAN NOT NULL DEFAULT 0,
                    is_active   BOOLEAN NOT NULL DEFAULT 1,
                    sort_order  INTEGER NOT NULL DEFAULT 100,
                    created_at  DATETIME,
                    updated_at  DATETIME
                )
            """))
        else:
            conn.execute(text("""
                CREATE TABLE hotlines (
                    id          SERIAL PRIMARY KEY,
                    label       VARCHAR NOT NULL,
                    dial        VARCHAR,
                    display     VARCHAR NOT NULL,
                    description VARCHAR,
                    is_critical BOOLEAN NOT NULL DEFAULT FALSE,
                    is_test     BOOLEAN NOT NULL DEFAULT FALSE,
                    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
                    sort_order  INTEGER NOT NULL DEFAULT 100,
                    created_at  TIMESTAMP DEFAULT NOW(),
                    updated_at  TIMESTAMP DEFAULT NOW()
                )
            """))
        print("  hotlines: created")

    count = conn.execute(text("SELECT COUNT(*) FROM hotlines")).scalar()
    if count:
        print("  hotlines: %d row(s) already present, not seeding" % count)
    else:
        for label, dial, display, desc, crit, test, active, order in SEED:
            conn.execute(text("""
                INSERT INTO hotlines
                    (label, dial, display, description, is_critical, is_test, is_active, sort_order)
                VALUES
                    (:label, :dial, :display, :desc, :crit, :test, :active, :order)
            """), {"label": label, "dial": dial, "display": display, "desc": desc,
                   "crit": crit, "test": test, "active": active, "order": order})
        print("  hotlines: seeded %d entries" % len(SEED))

print("Done.")
print()
print("The app shows the same numbers it showed before, except the test line,")
print("which is seeded inactive. Two entries carry a NOTE in their description")
print("flagging that they need checking - edit them in Admin Management once")
print("the barangay confirms the real numbers.")
