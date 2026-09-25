from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class CaseActivity(Base):
    """Who did what to a case, and when.

    The admin Terms tell every officer that "actions in this portal are
    attributed to your account, including status changes, messages to the
    complainant, and deletions". Only messages were: nothing recorded who moved
    a case to Closed or who deleted a report, so the honest answer to "who
    changed this?" was that the system did not know. This table is what makes
    that sentence true.

    Accountability is the whole point, so it is append-only by convention:
    nothing in the app updates or removes a row.
    """

    __tablename__ = "case_activities"

    id         = Column(Integer, primary_key=True, index=True)
    case_id    = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)

    admin_id   = Column(Integer, ForeignKey("admins.id"), nullable=True)
    # The name is snapshotted, not looked up through admin_id. An officer can
    # leave the barangay and have their account removed; the record of what they
    # did to a case has to outlive the account, or the audit trail empties
    # itself exactly when someone has reason to want it emptied.
    admin_name = Column(String, nullable=True)

    action     = Column(String, nullable=False)   # status_changed, case_deleted, ...
    detail     = Column(String, nullable=True)    # human-readable, already-safe text
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    case  = relationship("Case", foreign_keys=[case_id])
    admin = relationship("Admin", foreign_keys=[admin_id])


def log_activity(db, case_id: int, admin, action: str, detail: str = None) -> None:
    """Record an action against a case. Does NOT commit: the caller's own commit
    carries it, so the log and the change it describes land together or not at
    all.

    Never raises. An audit row failing to write must not stop an officer from
    changing a case status, and a half-failed request would be worse than a
    missing line in the log.
    """
    try:
        name = None
        if admin is not None:
            name = (getattr(admin, "full_name", None)
                    or getattr(admin, "name", None)
                    or getattr(admin, "username", None))
        db.add(CaseActivity(
            case_id=case_id,
            admin_id=getattr(admin, "id", None),
            admin_name=name,
            action=action,
            detail=detail,
        ))
    except Exception as e:  # noqa: BLE001
        print(f"[ACTIVITY] could not record {action} on case {case_id}: {e}")
