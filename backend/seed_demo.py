"""Create demo cases for a walkthrough or a defense.

The point of this script is that an empty database demos badly. The dashboard
shows zeros, the timelines have nothing to draw, and there is no way to show a
panel what a BPO or a closed case looks like without filling in the victim app
by hand for an hour. This builds a small, realistic spread instead: one case at
every stage that matters.

REFUSES TO RUN on a database that already has victim accounts, unless you pass
--force. That guard exists so this can never be pointed at real pilot data and
quietly add fake cases to it.

    .\\venv\\Scripts\\python.exe seed_demo.py

Every record it writes is encrypted exactly as the app encrypts it, so the demo
data behaves like real data: masked where masking applies, decrypted for the
officer handling the case.
"""
import os
import sys
from datetime import datetime, timedelta, date

from dotenv import load_dotenv

load_dotenv()

from database import SessionLocal, engine, Base  # noqa: E402
import models  # noqa: E402,F401  (registers the core models)
from models.user import User  # noqa: E402
from models.case import Case, ClosureReason, RelationshipToOffender  # noqa: E402
from models.report import Report, ReportStatus  # noqa: E402
from models.bpo import BPO, BPOStatus  # noqa: E402
from models.case_activity import CaseActivity  # noqa: E402
from models.admin import Admin  # noqa: E402
# Every model, so SQLAlchemy can resolve the relationships between them.
# Importing only the ones this script writes leaves Case.messages pointing
# at a class the registry has never seen, and the mapper refuses to build.
from models.case_message import CaseMessage  # noqa: E402,F401
from models.child import Child  # noqa: E402,F401
from models.endorsement import Endorsement  # noqa: E402,F401
from models.barangay_official import BarangayOfficial  # noqa: E402,F401
from models.otp import OTP  # noqa: E402,F401
from core.security import hash_password  # noqa: E402
from core.encryption import encrypt, encrypt_float  # noqa: E402

FORCE = "--force" in sys.argv
DEMO_PASSWORD = "DemoVictim@2026"


def _target() -> str:
    url = os.getenv("DATABASE_URL", "")
    host = url.split("@")[-1].split("/")[0]
    if "neon" in host.lower():
        return "NEON (production)  [" + host + "]"
    if "localhost" in host or "127.0.0.1" in host:
        return "LOCAL (your laptop)  [" + host + "]"
    return host or "(DATABASE_URL not set)"


print("Connecting to: " + _target())

Base.metadata.create_all(bind=engine)
db = SessionLocal()

existing = db.query(User).count()
if existing and not FORCE:
    raise SystemExit(
        "STOPPED: this database already has " + str(existing) + " victim account(s).\n"
        "Nothing was changed. This script is for an empty database. If you really\n"
        "mean to add demo cases alongside existing data, run it again with --force."
    )

officer = db.query(Admin).first()
if not officer:
    print("Note: no admin account exists yet, so the activity trail will say "
          "'Unknown officer'. Let the backend boot once to seed the super admin.")

# name, relationship, incident types, statement, address, status
PEOPLE = [
    ("Maria", "Santos", "current_spouse_partner", ["physical"],
     "Sinaktan niya ako matapos siyang uminom. May pasa ako sa braso at likod.",
     "24 Rizal Street, Purok 2", ReportStatus.submitted),

    ("Elena", "Reyes", "former_spouse_partner", ["psychological", "economic"],
     "Pinagbabantaan niya ako sa telepono at hindi na nagbibigay ng sustento sa mga bata.",
     "8 Bonifacio Street, Purok 5", ReportStatus.awaiting_onsite_visit),

    ("Josefa", "Lim", "current_dating", ["physical", "psychological"],
     "Sinampal niya ako sa harap ng mga kapitbahay at sinabing papatayin niya ako.",
     "17 Mabini Street, Purok 1", ReportStatus.bpo_issued),

    ("Rosa", "Aquino", "immediate_family", ["economic"],
     "Kinukuha ng kapatid ko ang kita ko at hindi ako pinapayagang magtrabaho.",
     "3 Luna Street, Purok 4", ReportStatus.closed),
]

year = datetime.utcnow().year
now = datetime.utcnow()
created = []

for i, (first, last, relation, itypes, statement, address, status) in enumerate(PEOPLE, start=1):
    user = User(
        first_name=first,
        last_name=last,
        email="demo.%s@example.com" % first.lower(),
        phone_number="0917000%04d" % i,
        birthdate=date(1990 + i, 3, 12),
        sex="Female",
        address="Barangay Palanginan, Iba, Zambales",
        password_hash=hash_password(DEMO_PASSWORD),
        is_verified=True,
    )
    db.add(user)
    db.flush()

    # Stagger the ages of the cases so the dashboard and the "submitted" column
    # do not all show the same timestamp, which looks obviously fabricated.
    age = timedelta(days=(len(PEOPLE) - i) * 3 + 1)

    case = Case(
        case_number="%d-000-%s" % (year, str(i).zfill(3)),
        user_id=user.id,
        offender_name=encrypt("Respondent %s" % last),
        status=status,
        relationship_to_offender=RelationshipToOffender(relation),
        created_at=now - age,
        updated_at=now - age,
    )
    if status == ReportStatus.closed:
        case.closure_reason = ClosureReason.transferred_residence
        case.closure_note = "Lumipat ng tirahan ang biktima; ipinasa sa C/MSWDO."
        case.closed_at = now - timedelta(days=1)
    db.add(case)
    db.flush()

    report = Report(
        case_id=case.id,
        statement=encrypt(statement),
        address=encrypt(address),
        latitude=encrypt_float(15.3276 + i * 0.001),
        longitude=encrypt_float(119.9784 + i * 0.001),
        incident_types=itypes,
        incident_type=itypes[0],
        incident_date=now - age - timedelta(days=1),
        created_at=now - age,
    )
    db.add(report)
    db.flush()

    # A BPO only for the case that claims one. The victim timeline is evidence
    # based: it reads the BPO record rather than the status, so inventing the
    # status without the record would show her a protection order that does not
    # exist.
    if status == ReportStatus.bpo_issued:
        issued = now - timedelta(days=2)
        db.add(BPO(
            case_id=case.id,
            bpo_number="BPO-%d-%s" % (year, str(i).zfill(3)),
            control_number="CN-%s" % str(i).zfill(3),
            status=BPOStatus.issued,
            relief_stop_physical_harm=True,
            relief_stop_threats=True,
            relief_stay_away_100m=True,
            applied_at=issued - timedelta(days=1),
            issued_at=issued,
            expires_at=issued + timedelta(days=15),
            issued_by_official="Hon. Punong Barangay",
        ))

    if officer:
        db.add(CaseActivity(
            case_id=case.id,
            admin_id=officer.id,
            admin_name=getattr(officer, "full_name", None) or officer.username,
            action="status_changed",
            detail="Submitted to %s" % status.value.replace("_", " ").title(),
            created_at=now - age + timedelta(hours=2),
        ))

    created.append((case.case_number, first + " " + last, status.value))

db.commit()
db.close()

print("")
print("Created %d demo cases:" % len(created))
for number, name, status in created:
    print("  %s  %-14s %s" % (number, name, status))
print("")
print("Victim sign-in for any of them:")
print("  email:    demo.maria@example.com  (or elena / josefa / rosa)")
print("  password: " + DEMO_PASSWORD)
print("")
print("These are demo records. Delete them before the system carries real reports.")
