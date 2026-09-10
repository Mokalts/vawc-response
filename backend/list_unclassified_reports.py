"""List reports that have no abuse type recorded, so they can be classified.

The dashboard says how many are unclassified but not which ones, and hunting
for them by clicking through every case is slow.

Read-only. Deliberately prints NO statement text, names, or addresses: it gives
you the case number and report number so you can open the case in the admin
panel and classify it there, where the statement is shown in context and the
change is recorded against your admin account. Statements are encrypted at
rest, and dumping victim testimony into a terminal window is not something a
convenience script should do.

Usage (from backend/):
    .\\venv\\Scripts\\python.exe list_unclassified_reports.py

To check production instead of your local database, set DATABASE_URL first
(copy it from Render -> your service -> Environment -> DATABASE_URL):
    $env:DATABASE_URL = "<connection string>"
"""
from sqlalchemy import text
from database import engine


def main():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT c.case_number,
                   r.id                AS report_id,
                   r.created_at,
                   c.id                AS case_id,
                   (r.statement IS NOT NULL AND r.statement <> '') AS has_statement,
                   (SELECT COUNT(*) FROM reports r2
                     WHERE r2.case_id = c.id AND r2.is_deleted = false) AS reports_in_case
            FROM reports r
            JOIN cases c ON c.id = r.case_id
            WHERE r.is_deleted = false
              AND c.is_deleted = false
              AND (r.incident_type IS NULL OR r.incident_type = '')
              AND (r.incident_types IS NULL
                   OR CAST(r.incident_types AS TEXT) IN ('[]', 'null'))
            ORDER BY c.case_number, r.created_at
        """)).fetchall()

    if not rows:
        print("No unclassified reports. Nothing to do.")
        return

    print(f"{len(rows)} unclassified report(s):\n")
    print(f"{'CASE NUMBER':<16} {'REPORT':<8} {'FILED':<12} {'STATEMENT':<10} {'REPORTS IN CASE'}")
    print("-" * 68)

    # Report number as shown in the admin UI is its position within the case.
    seen = {}
    for case_number, report_id, created_at, case_id, has_statement, n_reports in rows:
        seen[case_id] = seen.get(case_id, 0) + 1
        filed = created_at.strftime("%Y-%m-%d") if created_at else "-"
        print(f"{case_number:<16} #{report_id:<7} {filed:<12} "
              f"{'yes' if has_statement else 'NONE':<10} {n_reports}")

    print()
    print("To classify: open each case in the admin panel (Profiles -> the case),")
    print("scroll to the report card, and set the Type of Abuse dropdown.")
    print("A report with NO statement cannot be classified from its content —")
    print("check the photos or ask the complainant before guessing.")


if __name__ == "__main__":
    main()
