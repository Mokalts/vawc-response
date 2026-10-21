"""Notification preferences on users, and the user_activities table.

Two additions, both purely additive:

  1. users.notify_* - which kinds of message she wants. Defaults keep the old
     behaviour: everyone is opted in to case updates and desk messages over
     email, which is exactly what the app did before the columns existed.
     SMS defaults OFF, because a channel that silently fails is worse than one
     she has to ask for.
  2. user_activities - what she did on her own account. `case_activities`
     already recorded what officers did to her cases; nothing recorded her
     side, so "was that sign-in me?" had no answer anywhere in the system.

Nothing is dropped, nothing is rewritten, and no existing row changes meaning.
Safe to run more than once: every step checks first.

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

# column name -> default
NOTIFY_COLUMNS = {
    "notify_enabled":       "true",
    "notify_email":         "true",
    "notify_sms":           "false",
    "notify_case_updates":  "true",
    "notify_desk_messages": "true",
    # The only one defaulting false: a receipt in her inbox is a risk if the
    # person she is reporting reads her mail, so it is opt-in.
    "notify_report_receipt": "false",
}


def existing_columns(conn, table):
    if IS_SQLITE:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return {r[1] for r in rows}
    rows = conn.execute(text(
        "SELECT column_name FROM information_schema.columns WHERE table_name = :t"
    ), {"t": table}).fetchall()
    return {r[0] for r in rows}


def table_exists(conn, table):
    if IS_SQLITE:
        row = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = :t"
        ), {"t": table}).fetchone()
        return row is not None
    row = conn.execute(text(
        "SELECT to_regclass(:t)"
    ), {"t": "public." + table}).fetchone()
    return row is not None and row[0] is not None


with engine.begin() as conn:

    # ── 1. Notification preference columns ──────────────────────────────────
    have = existing_columns(conn, "users")
    if not have:
        raise SystemExit("No 'users' table found. Is DATABASE_URL pointing at the right database?")

    added = []
    for column, default in NOTIFY_COLUMNS.items():
        if column in have:
            continue
        conn.execute(text(
            f"ALTER TABLE users ADD COLUMN {column} BOOLEAN NOT NULL DEFAULT {default}"
        ))
        added.append(column)

    if added:
        print("  users: added " + ", ".join(added))
    else:
        print("  users: notification columns already present, nothing to do")

    # ── 2. user_activities ──────────────────────────────────────────────────
    if table_exists(conn, "user_activities"):
        print("  user_activities: already exists, nothing to do")
    else:
        if IS_SQLITE:
            conn.execute(text("""
                CREATE TABLE user_activities (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id    INTEGER NOT NULL REFERENCES users(id),
                    action     VARCHAR NOT NULL,
                    detail     VARCHAR,
                    created_at DATETIME NOT NULL
                )
            """))
        else:
            conn.execute(text("""
                CREATE TABLE user_activities (
                    id         SERIAL PRIMARY KEY,
                    user_id    INTEGER NOT NULL REFERENCES users(id),
                    action     VARCHAR NOT NULL,
                    detail     VARCHAR,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """))
        conn.execute(text(
            "CREATE INDEX ix_user_activities_user_id ON user_activities (user_id)"
        ))
        conn.execute(text(
            "CREATE INDEX ix_user_activities_created_at ON user_activities (created_at)"
        ))
        print("  user_activities: created")

print("Done.")
print()
print("The activity screen will not be empty for anyone who registered before")
print("this ran: it also reads the timestamps already on each account and the")
print("existing case_activities rows. Only sign-ins, sign-outs and password")
print("changes start from today.")
