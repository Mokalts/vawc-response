from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from database import Base


class DeletionRecord(Base):
    """What survives a permanent deletion.

    Permanent deletion removes the account, its cases, their reports, messages,
    BPOs, endorsements and the activity trail. Until now it removed the record
    of itself as well: afterwards nothing in the system said that anything had
    ever been there, let alone who removed it. An audit trail that is erased by
    the act it is meant to record is not an audit trail.

    So this row is written first and never touched again. It says that a
    deletion happened, who did it, when, and which case numbers went. That is
    enough to answer "what happened to case 2026-014?" months later.

    It deliberately holds NO personal data. No name, no email, no phone, no
    address. A victim who asks to be erased is erased; what remains is the fact
    that an officer erased her, which is a fact about the officer. Keeping her
    name here would quietly undo the thing she asked for, and would make this
    table the one place worth stealing.

    The officer's name is snapshotted rather than looked up through admin_id,
    for the same reason the case activity trail does it: an officer can leave
    the barangay and have their account removed, and the record of what they
    did has to outlive the account, or the trail empties itself exactly when
    someone has reason to want it emptied.
    """

    __tablename__ = "deletion_records"

    id = Column(Integer, primary_key=True, index=True)

    # "victim_account" or "case".
    kind = Column(String, nullable=False, index=True)

    # The internal id of what went. A reference, not an identity: on its own it
    # names nothing, and the row it pointed at no longer exists.
    subject_id = Column(Integer, nullable=True)

    # Case numbers, comma separated, e.g. "2026-014, 2026-031". These are the
    # handles the barangay actually uses in its own paperwork, so they are what
    # makes this record answerable later.
    case_numbers = Column(String, nullable=True)
    case_count = Column(Integer, nullable=False, default=0)

    admin_id = Column(Integer, nullable=True)
    admin_name = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


def record_deletion(db, kind, subject_id, admin, case_numbers=None):
    """Write the tombstone. Never raises, and never commits.

    Called before the delete, inside the same transaction, so it lands or rolls
    back with it. It must not be the reason a deletion fails: an officer who
    has decided to erase an account should not be stopped by the bookkeeping,
    and a swallowed failure here is visible in the logs.
    """
    try:
        numbers = [n for n in (case_numbers or []) if n]
        db.add(DeletionRecord(
            kind=kind,
            subject_id=subject_id,
            case_numbers=", ".join(numbers) if numbers else None,
            case_count=len(numbers),
            admin_id=getattr(admin, "id", None),
            admin_name=" ".join(filter(None, [
                getattr(admin, "first_name", ""), getattr(admin, "last_name", "")
            ])).strip() or getattr(admin, "username", None),
        ))
    except Exception as e:  # noqa: BLE001
        print(f"[AUDIT] could not record the deletion of {kind} {subject_id}: {e}")
