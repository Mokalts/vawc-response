"""Normalise legacy abuse-type values stored on reports.

Reports filed before the lawful-flow rebuild stored title-case labels
("Physical Abuse") in reports.incident_type, while the current intake stores
canonical ids ("physical"). Any breakdown grouped on the raw column therefore
splits one real category into two bars, which is what surfaced on the
dashboard's "Cases by Abuse Type" chart.

The routers now canonicalise on read, so the dashboard is correct with or
without this script. This cleans the stored data as well, so exports, ad-hoc
SQL, and anything written later start from one spelling.

Safe to re-run: rows already canonical are skipped.

Usage (from backend/, venv active):
    py -3 migrate_normalize_abuse_types.py            # uses .env DATABASE_URL
    DATABASE_URL=<prod-url> py -3 migrate_normalize_abuse_types.py

Add --dry-run to print what would change without writing.
"""
import sys
from sqlalchemy import text
from database import engine
from core.status_labels import canonical_abuse_type, ABUSE_DISPLAY

DRY_RUN = "--dry-run" in sys.argv


def main():
    changed_single = 0
    changed_list = 0
    unknown = {}

    with engine.begin() as conn:
        # ── 1. reports.incident_type (single legacy column) ───────────────────
        rows = conn.execute(text(
            "SELECT id, incident_type FROM reports "
            "WHERE incident_type IS NOT NULL AND incident_type <> ''"
        )).fetchall()

        for rid, raw in rows:
            canon = canonical_abuse_type(raw)
            if canon is None or canon == raw:
                continue
            if canon not in ABUSE_DISPLAY:
                unknown[raw] = unknown.get(raw, 0) + 1
                continue          # leave unrecognised values alone
            print(f"  report {rid}: {raw!r} -> {canon!r}")
            if not DRY_RUN:
                conn.execute(
                    text("UPDATE reports SET incident_type = :v WHERE id = :i"),
                    {"v": canon, "i": rid},
                )
            changed_single += 1

        # ── 2. reports.incident_types (JSON list) ────────────────────────────
        rows = conn.execute(text(
            "SELECT id, incident_types FROM reports WHERE incident_types IS NOT NULL"
        )).fetchall()

        for rid, raw_list in rows:
            if not isinstance(raw_list, list) or not raw_list:
                continue
            new_list = []
            for item in raw_list:
                canon = canonical_abuse_type(item)
                if canon is None:
                    continue
                if canon not in ABUSE_DISPLAY:
                    unknown[item] = unknown.get(item, 0) + 1
                    canon = item          # keep as-is
                if canon not in new_list:  # de-duplicate while we are here
                    new_list.append(canon)
            if new_list != raw_list:
                print(f"  report {rid}: {raw_list} -> {new_list}")
                if not DRY_RUN:
                    conn.execute(
                        text("UPDATE reports SET incident_types = CAST(:v AS JSON) WHERE id = :i"),
                        {"v": __import__("json").dumps(new_list), "i": rid},
                    )
                changed_list += 1

    print()
    print(f"{'WOULD UPDATE' if DRY_RUN else 'UPDATED'}: "
          f"{changed_single} incident_type value(s), {changed_list} incident_types list(s)")
    if unknown:
        print("Unrecognised values left untouched (check these by hand):")
        for v, n in sorted(unknown.items(), key=lambda kv: -kv[1]):
            print(f"  {v!r} x{n}")
    print("Done." if not DRY_RUN else "Dry run only, nothing written.")


if __name__ == "__main__":
    main()
