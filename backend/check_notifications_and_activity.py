"""Read-only check that the notification/activity migration landed correctly.

Writes NOTHING. Point it at the branch you just migrated and it reports what
the two new screens will actually show for your real accounts, which is the
part a seeded test database cannot tell you.

    $env:DATABASE_URL="<branch connection string>"
    .\\venv\\Scripts\\python.exe check_notifications_and_activity.py
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("DATABASE_URL")
if not url:
    raise SystemExit("DATABASE_URL is not set. Set it for this terminal first.")

host = url.split("@")[-1].split("/")[0]
print("Reading from: " + host)
print("(read-only - this script issues no writes)")
print()

engine = create_engine(url)
IS_SQLITE = url.startswith("sqlite")

NOTIFY = ["notify_enabled", "notify_email", "notify_sms",
          "notify_case_updates", "notify_desk_messages"]

with engine.connect() as conn:

    # ── 1. Columns ──────────────────────────────────────────────────────────
    if IS_SQLITE:
        have = {r[1] for r in conn.execute(text("PRAGMA table_info(users)")).fetchall()}
    else:
        have = {r[0] for r in conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='users'"
        )).fetchall()}

    missing = [c for c in NOTIFY if c not in have]
    print("1. Notification columns")
    if missing:
        print("   MISSING: " + ", ".join(missing))
    else:
        print("   all five present")

    # ── 2. Existing accounts are opted in ───────────────────────────────────
    # The defaults are what keep every woman already registered receiving the
    # same mail she received yesterday. If this is not the full count, the
    # migration added the columns without the default and people would go
    # silent.
    if not missing:
        total = conn.execute(text(
            "SELECT COUNT(*) FROM users WHERE is_deleted = false")).scalar()
        opted = conn.execute(text(
            "SELECT COUNT(*) FROM users WHERE is_deleted = false "
            "AND notify_enabled AND notify_email AND notify_case_updates "
            "AND notify_desk_messages")).scalar()
        sms_on = conn.execute(text(
            "SELECT COUNT(*) FROM users WHERE is_deleted = false AND notify_sms")).scalar()
        print()
        print("2. Existing accounts")
        print("   active users                 : %d" % total)
        print("   still receiving case mail    : %d  %s"
              % (opted, "(all of them)" if opted == total else "<-- SOME WOULD GO SILENT"))
        print("   opted into SMS               : %d  (expected 0)" % sms_on)

    # ── 3. The activity table ───────────────────────────────────────────────
    print()
    print("3. user_activities")
    try:
        n = conn.execute(text("SELECT COUNT(*) FROM user_activities")).scalar()
        print("   exists, %d row(s) - empty is correct, it fills from today" % n)
    except Exception as e:
        print("   NOT USABLE: %s" % str(e).splitlines()[0])

    # ── 4. What the Activity screen will already show ───────────────────────
    # Everything here predates the migration, which is the answer to "will it
    # be blank for women who registered months ago".
    print()
    print("4. What Activity shows per account, from records that already exist")
    rows = conn.execute(text("""
        SELECT u.id,
               u.created_at IS NOT NULL                        AS has_created,
               u.id_submitted_at IS NOT NULL                   AS has_id_sent,
               u.id_reviewed_at IS NOT NULL                    AS has_id_reviewed,
               (SELECT COUNT(*) FROM cases c
                 WHERE c.user_id = u.id AND c.is_deleted = false) AS cases,
               (SELECT COUNT(*) FROM reports r
                 JOIN cases c2 ON c2.id = r.case_id
                WHERE c2.user_id = u.id AND r.is_deleted = false
                  AND c2.is_deleted = false)                   AS reports,
               (SELECT COUNT(*) FROM case_activities a
                 JOIN cases c3 ON c3.id = a.case_id
                WHERE c3.user_id = u.id AND c3.is_deleted = false
                  AND a.action IN ('status_changed','assistance_ended','case_reopened',
                                   'message_sent','respondent_corrected'))  AS desk_actions
          FROM users u
         WHERE u.is_deleted = false
         ORDER BY u.id
    """)).fetchall()

    print("   user  entries  (account + ID steps + reports + barangay actions)")
    blank = 0
    for r in rows:
        entries = (1 if r.has_created else 0) + (1 if r.has_id_sent else 0) \
                  + (1 if r.has_id_reviewed else 0) + r.reports + r.desk_actions
        if entries == 0:
            blank += 1
        print("   %4d  %7d   (reports %d, barangay %d, cases %d)"
              % (r.id, entries, r.reports, r.desk_actions, r.cases))
    print()
    print("   accounts whose Activity screen would be empty: %d" % blank)

print()
print("Nothing was written. Safe to run again.")
