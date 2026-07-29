"""
One-off migration:
  1. Add 'under_process' to the reportstatus enum (after awaiting_onsite_visit)
  2. Add admin_message / admin_message_at columns to cases

Run once:  python migrate_under_process.py
Safe to run multiple times (uses IF NOT EXISTS).
"""
from sqlalchemy import text
from database import engine


def run():
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block -> AUTOCOMMIT
    with engine.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        conn.execute(text(
            "ALTER TYPE reportstatus ADD VALUE IF NOT EXISTS 'under_process' AFTER 'awaiting_onsite_visit'"
        ))
        print("OK: enum value 'under_process' ensured")

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE cases ADD COLUMN IF NOT EXISTS admin_message TEXT"))
        conn.execute(text("ALTER TABLE cases ADD COLUMN IF NOT EXISTS admin_message_at TIMESTAMP"))
        print("OK: columns admin_message / admin_message_at ensured")

    print("Migration complete.")


if __name__ == "__main__":
    run()
