from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from database import Base


class Hotline(Base):
    """A number on the emergency panel.

    These were a constant in the victim app, so correcting one meant a code
    change and two deploys. The desk is who finds out that a line has moved,
    so the desk is who should be able to fix it.

    Nothing here is personal data: it is the published contact details of
    public offices, which is why this table is readable without a session. The
    victim app must be able to show hotlines to someone who has no account and
    is not signed in - that is the whole point of them.
    """

    __tablename__ = "hotlines"

    id          = Column(Integer, primary_key=True, index=True)

    label       = Column(String, nullable=False)   # "Barangay Palanginan VAWC Desk"
    # What a keypad should dial. Null for a line published as letters, which
    # cannot be dialled - the app then renders `display` as plain text rather
    # than a call link, because a tel: link that does nothing is worse than
    # none at all.
    dial        = Column(String, nullable=True)
    display     = Column(String, nullable=False)   # "0928 667 3772"
    description = Column(String, nullable=True)    # who answers, and when

    # Drawn first and in the accent colour. For 911 and nothing else, normally.
    is_critical = Column(Boolean, default=False, nullable=False)
    # Marks a line as not a real service, so it can be shown during testing
    # without a woman in trouble mistaking it for help.
    is_test     = Column(Boolean, default=False, nullable=False)
    # Hidden from the app without being deleted, for a line that is temporarily
    # down. Deleting is still allowed; this is for "not right now".
    is_active   = Column(Boolean, default=True, nullable=False)

    sort_order  = Column(Integer, default=100, nullable=False)

    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
