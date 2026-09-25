"""Create the case_activities table and encrypt existing incident addresses.

Two changes in one pass:

  1. case_activities - who changed a status, sent a message, or deleted
     something. The admin Terms already promised this attribution; nothing
     recorded it.
  2. reports.address - the typed street/landmark of an incident was stored in
     plain text while its GPS coordinates were encrypted, and while the victim
     privacy notice says "your location" is encrypted at rest.

Safe to run more than once. Rows that are already encrypted are skipped, and
decrypt() falls back to returning plain text, so the app works whether or not
this has been run.

Run it with the project's venv Python, not the system one: the dependencies
live in the venv.
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
from core.encryption import encrypt, decrypt  # noqa: E402

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

# ── Guard against the wrong encryption key ───────────────────────────────────
# ENCRYPTION_KEY here must be the same one the live data was encrypted with. If
# it is not, this script would happily encrypt every address with a key
# production cannot read, and the damage would only surface later, when an
# officer opens a case and finds gibberish where the address should be.
#
# So: take a value already known to be ciphertext and check that it decrypts.
# Fernet tokens start with "gAAAAA", and decrypt() returns its input unchanged
# when it fails, so a value that comes back unchanged means the key is wrong.
with engine.begin() as conn:
    sample = conn.execute(text(
        "SELECT statement FROM reports WHERE statement IS NOT NULL LIMIT 1"
    )).fetchone()

if sample and sample[0] and str(sample[0]).startswith("gAAAAA"):
    if decrypt(sample[0]) == sample[0]:
        raise SystemExit(
            "STOPPED: ENCRYPTION_KEY does not match the key this database was "
            "encrypted with. Nothing was changed. Set ENCRYPTION_KEY for this "
            "terminal to the value from the Render environment, then run again."
        )
    print("Encryption key: matches the existing data.")
else:
    print("Encryption key: no existing ciphertext to check against, continuing.")

# ── 1. The attribution table ─────────────────────────────────────────────────
with engine.begin() as conn:
    conn.execute(text(
        "CREATE TABLE IF NOT EXISTS case_activities ("
        " id         SERIAL PRIMARY KEY,"
        " case_id    INTEGER NOT NULL REFERENCES cases(id),"
        " admin_id   INTEGER REFERENCES admins(id),"
        " admin_name VARCHAR,"
        " action     VARCHAR NOT NULL,"
        " detail     VARCHAR,"
        " created_at TIMESTAMP NOT NULL DEFAULT NOW()"
        ")"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_case_activities_case_id"
        " ON case_activities (case_id)"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_case_activities_created_at"
        " ON case_activities (created_at)"
    ))
    print("case_activities: ready.")

# ── 2. Encrypt incident addresses already in the database ────────────────────
with engine.begin() as conn:
    rows = conn.execute(text(
        "SELECT id, address FROM reports"
        " WHERE address IS NOT NULL AND address <> ''"
    )).fetchall()

    done = 0
    skipped = 0
    for rid, addr in rows:
        # An already-encrypted value decrypts to something different from
        # itself; a plain-text one comes back unchanged, because decrypt()
        # returns its input when it cannot decrypt.
        if decrypt(addr) != addr:
            skipped += 1
            continue
        conn.execute(
            text("UPDATE reports SET address = :a WHERE id = :i"),
            {"a": encrypt(addr), "i": rid},
        )
        done += 1

    print("reports.address: " + str(done) + " encrypted, "
          + str(skipped) + " already encrypted.")

print("Done.")
