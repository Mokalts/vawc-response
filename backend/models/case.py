from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from models.report import ReportStatus


class Case(Base):
    __tablename__ = "cases"

    id                = Column(Integer, primary_key=True, index=True)
    case_number       = Column(String, unique=True, nullable=False)
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_id          = Column(Integer, ForeignKey("admins.id"), nullable=True)

    # Encrypted at API layer
    offender_name     = Column(String, nullable=False)

    # Status lives on the Case
    status            = Column(
        SAEnum(ReportStatus, name="reportstatus", create_type=False),
        default=ReportStatus.submitted,
        nullable=False,
    )

    has_status_update = Column(Boolean, default=False, nullable=False)

    # Free-text message from the Super Admin to the victim (e.g., hearing notice)
    admin_message     = Column(Text, nullable=True)
    admin_message_at  = Column(DateTime, nullable=True)

    # Soft delete
    is_deleted        = Column(Boolean, default=False, nullable=False)
    delete_reason     = Column(Text, nullable=True)
    deleted_at        = Column(DateTime, nullable=True)
    admin_recovered   = Column(Boolean, default=False, nullable=False)

    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user       = relationship("User", back_populates="cases")
    handled_by = relationship("Admin", back_populates="handled_cases")
    reports    = relationship("Report", back_populates="case", cascade="all, delete-orphan")
    messages   = relationship("CaseMessage", back_populates="case", cascade="all, delete-orphan", order_by="CaseMessage.created_at")
