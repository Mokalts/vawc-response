from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Boolean, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class ReportStatus(str, enum.Enum):
    # Lawful VAWC flow (RA 9262 / JMC 2010-2): the barangay does NOT mediate,
    # conciliate, or settle VAWC cases, and issues no CFA/Summons. The mandated
    # outputs are the BPO, referral/endorsement, and documentation.
    submitted             = "submitted"
    under_assessment      = "under_assessment"       # was "under_process"
    awaiting_onsite_visit = "awaiting_onsite_visit"  # investigation, not mediation
    bpo_applied           = "bpo_applied"
    bpo_issued            = "bpo_issued"
    bpo_served            = "bpo_served"
    endorsed              = "endorsed"
    closed                = "closed"                 # always with a ClosureReason; never "resolved/settled"


class Report(Base):
    __tablename__ = "reports"

    id            = Column(Integer, primary_key=True, index=True)
    case_id       = Column(Integer, ForeignKey("cases.id"), nullable=False)

    # Encrypted
    statement     = Column(String, nullable=False)
    latitude      = Column(String, nullable=True)
    longitude     = Column(String, nullable=True)

    # Not encrypted
    photo_urls    = Column(JSON, default=list)
    address       = Column(String, nullable=True)
    # Physical and psychological abuse commonly co-occur, so store a list of the
    # RA 9262 forms: "physical","sexual","psychological","economic","others".
    incident_types = Column(JSON, default=list)
    # Kept for one release (populated from incident_types[0]) so existing queries
    # and the monthly report keep working. Remove in a later pass.
    incident_type = Column(String, nullable=True)
    incident_date = Column(DateTime, nullable=True)

    # Admin unread tracking per testimony
    is_read       = Column(Boolean, default=False, nullable=False)

    # Soft delete
    is_deleted    = Column(Boolean, default=False, nullable=False)
    deleted_at    = Column(DateTime, nullable=True)

    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="reports")
