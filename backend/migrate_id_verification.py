"""Add the ID verification columns, and make existing photographs private.

Two parts.

1. Seven nullable columns on `users` for identity verification. Purely
   additive: every existing account reads back as id_status "none", which is
   exactly what it is.

2. Evidence photographs uploaded before authenticated delivery are still
   PUBLIC Cloudinary assets: unguessable URLs that anyone holding can open,
   with no sign-in, for ever. New uploads are authenticated; this flips the old
   ones and rewrites the stored value from a URL to a public id so the app
   serves them through its own expiring links like everything else.

Safe to run more than once. Columns already present are skipped, and an asset
already authenticated is left alone.

    $env:DATABASE_URL="<connection string>"
    .\\venv\\Scripts\\python.exe migrate_id_verification.py
"""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

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

# ── 1. The columns ───────────────────────────────────────────────────────────
COLUMNS = {
    "id_status": "VARCHAR DEFAULT 'none' NOT NULL",
    "id_type": "VARCHAR",
    "id_document": "VARCHAR",
    "id_submitted_at": "TIMESTAMP",
    "id_reviewed_at": "TIMESTAMP",
    "id_reviewed_by": "VARCHAR",
    "id_reject_reason": "VARCHAR",
}

with engine.begin() as conn:
    existing = {
        row[0]
        for row in conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
        ))
    }
    if not existing:
        raise SystemExit("No 'users' table found. Check DATABASE_URL points where you think it does.")

    added = 0
    for name, ddl in COLUMNS.items():
        if name in existing:
            print("  " + name + ": already present, skipping.")
            continue
        conn.execute(text("ALTER TABLE users ADD COLUMN " + name + " " + ddl))
        print("  " + name + ": added.")
        added += 1

print("Columns: " + str(added) + " added.")
print("")

# ── 2. Make the photographs already in Cloudinary private ────────────────────
# Imported here, after the column work, so a Cloudinary problem cannot stop the
# schema change from landing.
import cloudinary  # noqa: E402
import cloudinary.api  # noqa: E402
import cloudinary.uploader  # noqa: E402
from core.config import settings  # noqa: E402

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)


def _public_id_from_url(value: str):
    """Pull the public id out of a stored Cloudinary URL.

    A delivery URL looks like
      https://res.cloudinary.com/<cloud>/image/upload/v123/folder/name.jpg
    and the id is everything after the version, without the extension.
    """
    if not value or "/upload/" not in value:
        return None
    tail = value.split("/upload/", 1)[1]
    parts = tail.split("/")
    if parts and parts[0].startswith("v") and parts[0][1:].isdigit():
        parts = parts[1:]
    if not parts:
        return None
    joined = "/".join(parts)
    return joined.rsplit(".", 1)[0] if "." in joined.rsplit("/", 1)[-1] else joined


with engine.begin() as conn:
    rows = conn.execute(text(
        "SELECT id, photo_urls FROM reports WHERE photo_urls IS NOT NULL"
    )).fetchall()

    flipped = already = failed = 0
    for report_id, photos in rows:
        if not photos:
            continue
        changed = False
        new_list = []
        for value in photos:
            if not isinstance(value, str) or not value.startswith("http"):
                new_list.append(value)          # already a public id
                already += 1
                continue
            pid = _public_id_from_url(value)
            if not pid:
                new_list.append(value)
                failed += 1
                print("  could not read a public id from: " + value[:70])
                continue
            try:
                cloudinary.api.update(pid, resource_type="image",
                                      type="upload", access_mode="authenticated")
                new_list.append(pid)
                changed = True
                flipped += 1
            except Exception as e:  # noqa: BLE001
                new_list.append(value)
                failed += 1
                print("  could not change " + pid + ": " + str(e)[:90])

        if changed:
            conn.execute(
                text("UPDATE reports SET photo_urls = CAST(:p AS JSON) WHERE id = :i"),
                {"p": __import__("json").dumps(new_list), "i": report_id},
            )

    print("Photographs: " + str(flipped) + " made private, "
          + str(already) + " already private, " + str(failed) + " could not be changed.")

print("")
print("Done.")
