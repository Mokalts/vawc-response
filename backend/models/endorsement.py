from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class EndorsementOffice(str, enum.Enum):
    pnp_iba_mps = "pnp_iba_mps"
    cmswdo      = "cmswdo"
    court       = "court"
    pao         = "pao"
    medical     = "medical"
    others      = "others"


class Endorsement(Base):
    __tablename__ = "endorsements"

    id                 = Column(Integer, primary_key=True, index=True)
    case_id            = Column(Integer, ForeignKey("cases.id"), nullable=False)
    endorsement_number = Column(Integer, nullable=False)   # 1 = "1st Endorsement", 2 = "2nd", ...
    to_office          = Column(SAEnum(EndorsementOffice, name="endorsementoffice"), nullable=False)
    to_office_other    = Column(String, nullable=True)
    purpose            = Column(String, nullable=True)     # maps to "for CASE NAME" on the paper form
    attached_documents = Column(JSON, default=list)        # e.g. ["blotter", "bpo"]

    date_endorsed      = Column(DateTime, nullable=False)
    signed_by_official = Column(String, nullable=True)     # snapshot

    # Acknowledgment — the paper 1st Endorsement has no ack section; an endorsement
    # is NOT complete until received_at is set (feeds the monitoring dashboard).
    received_by        = Column(String, nullable=True)
    received_at        = Column(DateTime, nullable=True)
    receipt_proof      = Column(String, nullable=True)     # Cloudinary URL

    created_at         = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="endorsements")
