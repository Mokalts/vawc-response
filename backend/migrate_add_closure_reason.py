"""Add the 'bpo_expired_no_incident' value to the closurereason enum.

Annex A of the Barangay VAW Desk Handbook lists reasons a victim does NOT want
to pursue a case. It has no category for a case that ended well, so a BPO that
ran its 15 days with no further incident could not be recorded truthfully. This
adds that outcome.

Purely additive: ALTER TYPE ... ADD VALUE. No rows are read or rewritten, and
existing closure reasons are untouched. Safe to re-run — it checks first.

RUN THIS BEFORE deploying the matching backend code. The new value is offered in
the closure dropdown, and the database rejects a value its enum does not know,
which would surface as a 500 when an officer tries to save.

Usage (from backend/):
    .\\venv\\Scripts\\python.exe migrate_add_closure_reason.py

For production, set the connection string first (Render -> Environment -> DATABASE_URL):
    $env:DATABASE_URL = "<connection string>"
"""
from sqlalchemy import text
from database import engine

NEW_VALUE = "bpo_expired_no_incident"
ENUM_NAME = "closurereason"


def main():
    with engine.begin() as conn:
        existing = [r[0] for r in conn.execute(text(
            "SELECT e.enumlabel FROM pg_enum e "
            "JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = :n"
        ), {"n": ENUM_NAME})]

        if not existing:
            print(f"ERROR: enum '{ENUM_NAME}' not found. Is DATABASE_URL pointing "
                  f"at the right database?")
            return

        print(f"current values: {existing}")

        if NEW_VALUE in existing:
            print(f"SKIP: '{NEW_VALUE}' already present. Nothing to do.")
            return

        # ADD VALUE cannot run inside a transaction block on older PostgreSQL,
        # so use an autocommit connection for it.
        conn.execute(text(f"ALTER TYPE {ENUM_NAME} ADD VALUE IF NOT EXISTS '{NEW_VALUE}'"))
        print(f"OK: added '{NEW_VALUE}' to {ENUM_NAME}")

    with engine.connect() as conn:
        after = [r[0] for r in conn.execute(text(
            "SELECT e.enumlabel FROM pg_enum e "
            "JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = :n"
        ), {"n": ENUM_NAME})]
        print(f"values now:     {after}")
    print("Done.")


if __name__ == "__main__":
    main()
