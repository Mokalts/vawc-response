"""
One-off migration to the lawful VAWC flow (RA 9262 / JMC 2010-2).

Replaces the CFA/Summons/"resolved" model with the BPO + endorsement + closure
model. See VAWC-Response-Change-Spec.md Section 5.

  * renames status `under_process` -> `under_assessment`
  * folds summon_issued/summon_acknowledged -> under_assessment
  * folds cfa_issued/referred_to_police -> endorsed
  * folds resolved -> closed (closure_reason = legacy_settled_at_barangay)
  * drops cases.summon_tracking
  * adds the new case columns and the bpos/children/endorsements/barangay_officials tables
  * backfills reports.incident_types from reports.incident_type
  * seeds barangay_officials

BACK UP THE DATABASE BEFORE RUNNING THIS IN PRODUCTION.
Run once:  python migrate_lawful_flow.py   (uses DATABASE_URL from env/.env)
On a FRESH database this script is unnecessary — Base.metadata.create_all handles it.
Safe to re-run: each step guards against already-applied state.
"""
from sqlalchemy import text, inspect
from database import engine, Base
# Import every model so create_all knows the new tables.
import models.case, models.report, models.bpo, models.child, models.endorsement, models.barangay_official  # noqa


NEW_STATUS = [
    "submitted", "under_assessment", "awaiting_onsite_visit",
    "bpo_applied", "bpo_issued", "bpo_served", "endorsed", "closed",
]

STATUS_MAP = {
    "submitted": "submitted",
    "awaiting_onsite_visit": "awaiting_onsite_visit",
    "under_process": "under_assessment",
    "summon_issued": "under_assessment",
    "summon_acknowledged": "under_assessment",
    "cfa_issued": "endorsed",
    "referred_to_police": "endorsed",
    "resolved": "closed",
}


def _create_enum(conn, name, values):
    vals = ", ".join(f"'{v}'" for v in values)
    conn.execute(text(f"""
        DO $$ BEGIN
            CREATE TYPE {name} AS ENUM ({vals});
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """))


def run():
    insp = inspect(engine)
    case_cols = {c["name"] for c in insp.get_columns("cases")} if insp.has_table("cases") else set()

    # ── 1. New enum types (idempotent) ────────────────────────────────────────
    with engine.begin() as conn:
        _create_enum(conn, "closurereason", [
            "lost_interest_to_file", "reconciled_without_mediation", "transferred_residence",
            "lack_of_support", "lack_of_confidence_in_provider", "referred_and_completed",
            "others", "legacy_settled_at_barangay",
        ])
        _create_enum(conn, "relationshiptooffender", [
            "current_spouse_partner", "former_spouse_partner", "current_dating", "former_dating",
            "employer_supervisor", "agent_of_employer", "teacher_instructor", "coach_trainer",
            "person_of_authority", "neighbor_coworker", "immediate_family", "other_relative",
            "stranger", "others",
        ])
        _create_enum(conn, "caseseverity", ["low", "moderate", "high", "critical"])
        _create_enum(conn, "bpostatus", ["applied", "issued", "served", "expired", "superseded"])
        _create_enum(conn, "endorsementoffice", ["pnp_iba_mps", "cmswdo", "court", "pao", "medical", "others"])
        _create_enum(conn, "officialrole", ["punong_barangay", "vawc_officer", "bsdo", "secretary"])
        print("OK: new enum types ensured")

    # ── 2. New columns on cases (nullable) ────────────────────────────────────
    add_cols = [
        ("relationship_to_offender", "relationshiptooffender"),
        ("severity",                 "caseseverity"),
        ("closure_reason",           "closurereason"),
        ("closure_note",             "TEXT"),
        ("closed_at",                "TIMESTAMP"),
        ("closed_by_admin_id",       "INTEGER"),
        ("applicant_name",           "VARCHAR"),
        ("applicant_address",        "VARCHAR"),
        ("applicant_contact",        "VARCHAR"),
        ("applicant_relation",       "VARCHAR"),
        ("applicant_consent_note",   "TEXT"),
        ("reported_to_pnp_at",       "TIMESTAMP"),
        ("reported_to_mswdo_at",     "TIMESTAMP"),
    ]
    with engine.begin() as conn:
        for col, typ in add_cols:
            conn.execute(text(f'ALTER TABLE cases ADD COLUMN IF NOT EXISTS {col} {typ}'))
        # severity defaults to 'moderate' and is NOT NULL in the model; set existing rows.
        conn.execute(text("UPDATE cases SET severity = 'moderate' WHERE severity IS NULL"))
        print("OK: new case columns ensured")

    # Is the status column still on the OLD enum? (Idempotency guard — steps 3-5
    # are destructive and must run exactly once.)
    with engine.connect() as conn:
        labels = {r[0] for r in conn.execute(text(
            "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'reportstatus'"
        ))}
    OLD_VALUES = {"resolved", "under_process", "summon_issued", "summon_acknowledged", "cfa_issued", "referred_to_police"}
    needs_status_migration = bool(OLD_VALUES & labels)

    if not needs_status_migration:
        print("SKIP: status enum already migrated (no old values present)")
    else:
        # ── 3. Mark legacy 'resolved' cases as closed/legacy BEFORE the enum swap ──
        with engine.begin() as conn:
            conn.execute(text("""
                UPDATE cases
                   SET closure_reason = 'legacy_settled_at_barangay',
                       closed_at = COALESCE(closed_at, updated_at)
                 WHERE status::text = 'resolved'
            """))
            print("OK: legacy resolved cases marked")

        # ── 4-5. Swap the status enum type with value remap ───────────────────
        with engine.begin() as conn:
            _create_enum(conn, "reportstatus_new", NEW_STATUS)
            case_when = " ".join(f"WHEN '{old}' THEN '{new}'::reportstatus_new" for old, new in STATUS_MAP.items())
            conn.execute(text("ALTER TABLE cases ALTER COLUMN status DROP DEFAULT"))
            conn.execute(text(f"""
                ALTER TABLE cases
                ALTER COLUMN status TYPE reportstatus_new
                USING (CASE status::text {case_when} ELSE 'submitted'::reportstatus_new END)
            """))
            conn.execute(text("DROP TYPE reportstatus"))
            conn.execute(text("ALTER TYPE reportstatus_new RENAME TO reportstatus"))
            conn.execute(text("ALTER TABLE cases ALTER COLUMN status SET DEFAULT 'submitted'"))
            print("OK: status enum migrated to lawful values")

    # ── 6. Drop summon_tracking ───────────────────────────────────────────────
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE cases DROP COLUMN IF EXISTS summon_tracking"))
        print("OK: summon_tracking dropped")

    # ── 7. Create new tables + reports.incident_types ─────────────────────────
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE reports ADD COLUMN IF NOT EXISTS incident_types JSON"))
    Base.metadata.create_all(bind=engine)   # creates bpos, children, endorsements, barangay_officials
    print("OK: new tables ensured + reports.incident_types added")

    # ── 8. Backfill incident_types from incident_type ─────────────────────────
    with engine.begin() as conn:
        rows = conn.execute(text(
            "SELECT id, incident_type FROM reports WHERE incident_types IS NULL AND incident_type IS NOT NULL"
        )).fetchall()
        for rid, itype in rows:
            key = (itype or "").strip().lower().split()[0] if itype else None
            val = key if key in ("physical", "sexual", "psychological", "economic") else "others"
            conn.execute(text("UPDATE reports SET incident_types = :v WHERE id = :id"),
                         {"v": __import__("json").dumps([val]), "id": rid})
        conn.execute(text("UPDATE reports SET incident_types = '[]' WHERE incident_types IS NULL"))
        print(f"OK: backfilled incident_types for {len(rows)} report(s)")

    # ── 9. Seed barangay officials (only if empty) ────────────────────────────
    with engine.begin() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM barangay_officials")).scalar()
        if count == 0:
            conn.execute(text("""
                INSERT INTO barangay_officials (role, full_name, is_active) VALUES
                  ('punong_barangay', 'HON. EDMOND P. BALTAZAR', true),
                  ('vawc_officer',    'MARIA THERESA M. DE LEON', true),
                  ('bsdo',            'GILBERT C. DOLOJAN',       true)
            """))
            print("OK: seeded barangay officials")
        else:
            print(f"SKIP: barangay_officials already has {count} row(s)")

    print("Migration complete.")


if __name__ == "__main__":
    run()
