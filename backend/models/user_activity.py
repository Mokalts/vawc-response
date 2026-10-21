from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class UserActivity(Base):
    """What a woman did on her own account, and when.

    `case_activities` already records what officers did to her cases. Nothing
    recorded what she did herself, so "was that sign-in me?" had no answer in
    the system at all. This is the half of the trail that belongs to her, and
    it is the half she can read.

    Deliberately NO IP address and NO device string. The security value of this
    log is almost entirely in the timestamp: a woman who did not sign in at
    three in the morning knows that from the time alone. An IP is a location
    trace on a domestic-abuse victim, kept in a row an officer with database
    access could read, and it would need its own line in the privacy notice to
    be lawful to collect. The trade is not worth it.

    Append-only by convention, like case_activities: nothing updates a row.
    """

    __tablename__ = "user_activities"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # signed_in | signed_out | password_changed | profile_updated |
    # id_submitted | report_filed | account_recovered
    action     = Column(String, nullable=False)
    # Human-readable and already safe to render. Never holds the content of a
    # report or anything she typed about an incident.
    detail     = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user = relationship("User", foreign_keys=[user_id])


def log_user_activity(db, user_id: int, action: str, detail: str = None) -> None:
    """Record something she did. Does NOT commit: the caller's own commit
    carries it, so the log and the thing it describes land together or not at
    all.

    Never raises. A failure to write the trail must not fail the sign-in or the
    password change that it was describing — losing one row is better than
    locking her out of her own account because the log table is unhappy.
    """
    try:
        db.add(UserActivity(user_id=user_id, action=action, detail=detail))
    except Exception as e:          # pragma: no cover - defensive
        print(f"[Activity] could not record {action} for user {user_id}: {e}")
