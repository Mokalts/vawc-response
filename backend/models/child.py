from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Child(Base):
    """Children of the victim (BPO Application items 4 and 4a). Minors' data —
    name and date_of_birth are ENCRYPTED at the API layer and masked in responses."""
    __tablename__ = "children"

    id             = Column(Integer, primary_key=True, index=True)
    case_id        = Column(Integer, ForeignKey("cases.id"), nullable=False)
    name           = Column(String, nullable=False)   # ENCRYPTED
    date_of_birth  = Column(String, nullable=True)     # ENCRYPTED
    sex            = Column(String, nullable=True)
    under_her_care = Column(Boolean, default=False, nullable=False)   # item 4a
    created_at     = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="children")
