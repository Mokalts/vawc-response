from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SAEnum
import enum
from database import Base


class OfficialRole(str, enum.Enum):
    punong_barangay = "punong_barangay"
    vawc_officer    = "vawc_officer"
    bsdo            = "bsdo"
    secretary       = "secretary"


class BarangayOfficial(Base):
    """Current barangay officials. Document templates pull the ACTIVE official from
    this table so a template can never carry a stale (previous) official's name."""
    __tablename__ = "barangay_officials"

    id         = Column(Integer, primary_key=True, index=True)
    role       = Column(SAEnum(OfficialRole, name="officialrole"), nullable=False)
    full_name  = Column(String, nullable=False)
    is_active  = Column(Boolean, default=True, nullable=False)
    term_start = Column(DateTime, nullable=True)
    term_end   = Column(DateTime, nullable=True)
