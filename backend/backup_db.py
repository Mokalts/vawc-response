"""Dump every table to a timestamped JSON file.

There is no pg_dump on this machine, so this reads the database through
SQLAlchemy instead and writes one file you can keep. It is a snapshot for
safety, not a migration tool: the point is that losing the database should
never mean losing the records.

Encrypted columns are copied exactly as they are stored, so the backup file
stays encrypted too. It is only readable with the same ENCRYPTION_KEY, which is
what you want for a file holding VAWC case data. Keep it somewhere you would be
willing to keep the database itself.

    $env:DATABASE_URL="<connection string>"
    .\\venv\\Scripts\\python.exe backup_db.py

Writes to backups\\vawc-backup-YYYYMMDD-HHMMSS.json
"""
import os
import json
import decimal
import datetime as dt
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, MetaData, select

load_dotenv()

url = os.getenv("DATABASE_URL")
if not url:
    raise SystemExit("DATABASE_URL is not set. Set it for this terminal first.")


def _target() -> str:
    host = url.split("@")[-1].split("/")[0]
    if "neon" in host.lower():
        return "NEON  [" + host + "]"
    if "localhost" in host or "127.0.0.1" in host:
        return "LOCAL (your laptop)  [" + host + "]"
    return host


def _plain(value):
    """Make a database value JSON-safe without changing what it means."""
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", "replace")
    return value


print("Reading from: " + _target())

engine = create_engine(url)
meta = MetaData()
meta.reflect(bind=engine)

if not meta.tables:
    raise SystemExit("No tables found. Check that DATABASE_URL points where you think it does.")

data = {}
counts = []
with engine.connect() as conn:
    for name in sorted(meta.tables):
        table = meta.tables[name]
        rows = [
            {col: _plain(val) for col, val in dict(row._mapping).items()}
            for row in conn.execute(select(table))
        ]
        data[name] = rows
        counts.append((name, len(rows)))

out_dir = Path("backups")
out_dir.mkdir(exist_ok=True)
stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
path = out_dir / ("vawc-backup-" + stamp + ".json")

with open(path, "w", encoding="utf-8") as f:
    json.dump(
        {
            "taken_at": dt.datetime.now().isoformat(),
            "source": _target(),
            "tables": data,
        },
        f,
        ensure_ascii=False,
        indent=1,
    )

print("")
for name, n in counts:
    if n:
        print("  %-22s %d" % (name, n))
print("")
print("Written to: " + str(path.resolve()))
print("Size: %.1f KB" % (path.stat().st_size / 1024))
print("")
print("This file holds case data. Encrypted columns stay encrypted, but treat it")
print("like the database: do not put it in the repo or anywhere shared.")
