from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class CaseMessage(Base):
    """
    Append-only log of messages the barangay sent to the victim for a case.
    Each send creates one immutable record (audit trail).
    """
    __tablename__ = "case_messages"

    id         = Column(Integer, primary_key=True, index=True)
    case_id    = Column(Integer, ForeignKey("cases.id"), nullable=False)
    admin_id   = Column(Integer, ForeignKey("admins.id"), nullable=True)

    message    = Column(Text, nullable=False)
    sent_email = Column(Boolean, default=False, nullable=False)
    sent_sms   = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    case  = relationship("Case", back_populates="messages")
    admin = relationship("Admin")
