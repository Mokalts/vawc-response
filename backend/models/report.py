from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Boolean, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class ReportStatus(str, enum.Enum):
    submitted             = "submitted"
    awaiting_onsite_visit = "awaiting_onsite_visit"
    under_process         = "under_process"
    summon_issued         = "summon_issued"
    summon_acknowledged   = "summon_acknowledged"
    resolved              = "resolved"
    referred_to_police    = "referred_to_police"


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
