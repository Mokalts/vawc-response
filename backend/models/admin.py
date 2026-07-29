from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    middle_name = Column(String, nullable=True)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, unique=True, nullable=False)
    employee_id = Column(String, unique=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    position = Column(String, nullable=False)  # "Admin", "Super Admin" — display label
    is_super_admin = Column(Boolean, default=False, nullable=False)  # canonical role flag
    password_hash = Column(String, nullable=False)

    # Face recognition
    face_descriptor = Column(JSON, nullable=True)       # 128 numbers stored as JSON array
    is_face_enrolled = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, nullable=True)         # ID of super admin who created this account
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Soft delete
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)        # Set when deleted, cleared on recovery

    # Relationships
    handled_cases = relationship("Case", back_populates="handled_by")

    @property
    def full_name(self):
        parts = [self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        parts.append(self.last_name)
        return " ".join(parts)
