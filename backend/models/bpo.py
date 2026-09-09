from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class BPOStatus(str, enum.Enum):
    applied    = "applied"
    issued     = "issued"
    served     = "served"
    expired    = "expired"
    superseded = "superseded"   # a newer BPO for a new incident exists


class BPO(Base):
    __tablename__ = "bpos"

    id                = Column(Integer, primary_key=True, index=True)
    case_id           = Column(Integer, ForeignKey("cases.id"), nullable=False)
    bpo_number        = Column(String, unique=True, nullable=False)
    control_number    = Column(String, nullable=True)   # barangay's own Control No.

    status            = Column(SAEnum(BPOStatus, name="bpostatus"), default=BPOStatus.applied, nullable=False)

    # Reliefs, matching the barangay BPO form checkboxes a, b, c
    relief_stop_physical_harm = Column(Boolean, default=False, nullable=False)
    relief_stop_threats       = Column(Boolean, default=False, nullable=False)
    relief_stay_away_100m     = Column(Boolean, default=False, nullable=False)

    applied_at        = Column(DateTime, nullable=True)
    issued_at         = Column(DateTime, nullable=True)
    expires_at        = Column(DateTime, nullable=True)   # issued_at + 15 days, computed on issue; NEVER modified
    served_at         = Column(DateTime, nullable=True)
    served_by         = Column(String, nullable=True)
    proof_of_service  = Column(String, nullable=True)     # Cloudinary URL of signed receipt / photo

    issued_by_official = Column(String, nullable=True)    # snapshot of the Punong Barangay at issue time

    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="bpos")
