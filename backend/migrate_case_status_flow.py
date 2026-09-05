"""
One-off migration for the revised case-status flow (#9):
  1. Add 'cfa_issued' and 'endorsed' to the reportstatus enum
  2. Add summon_tracking JSON column to cases (3-week warrant-officer tracking)

Run once:  python migrate_case_status_flow.py
Safe to run multiple times (uses IF NOT EXISTS).

To migrate the LIVE Neon DB, run with the production DATABASE_URL in the
environment (same way migrate_under_process.py was run).
"""
from sqlalchemy import text
from database import engine


def run():
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block -> AUTOCOMMIT
    with engine.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        conn.execute(text(
            "ALTER TYPE reportstatus ADD VALUE IF NOT EXISTS 'cfa_issued' AFTER 'resolved'"
        ))
        conn.execute(text(
            "ALTER TYPE reportstatus ADD VALUE IF NOT EXISTS 'endorsed' AFTER 'cfa_issued'"
        ))
        print("OK: enum values 'cfa_issued' and 'endorsed' ensured")

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE cases ADD COLUMN IF NOT EXISTS summon_tracking JSON"))
        print("OK: column summon_tracking ensured")

    print("Migration complete.")


if __name__ == "__main__":
    run()
