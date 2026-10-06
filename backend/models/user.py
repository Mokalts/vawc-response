from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    middle_name = Column(String, nullable=True)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, unique=True, index=True, nullable=False)
    birthdate = Column(Date, nullable=True)
    sex = Column(String, nullable=True)
    address = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    is_verified = Column(Boolean, default=False)

    # Minor / Guardian
    is_minor = Column(Boolean, default=False, nullable=False)
    guardian_name = Column(String, nullable=True)
    guardian_relationship = Column(String, nullable=True)

    # Soft delete
    # ── Identity verification ────────────────────────────────────────────
    # A CHECK, never a gate. She can report the moment she opens the app; this
    # only records whether an officer has seen an ID for the account. Requiring
    # one first would turn identification into a condition of being helped, and
    # a woman deciding whether to report is often doing it from a borrowed phone
    # with her documents in a house she has left.
    #
    # id_document holds the Cloudinary public id ONLY while a decision is
    # pending. Once an officer approves or rejects, the photograph is destroyed
    # and this goes back to NULL: the verification is the record worth keeping,
    # not an image of her ID sitting in storage for ever. That is data
    # minimisation under RA 10173, and it means a breach cannot leak documents
    # the system no longer holds.
    id_status = Column(String, default="none", nullable=False)  # none|pending|approved|rejected
    id_type = Column(String, nullable=True)                     # what she said it is
    id_document = Column(String, nullable=True)                 # transient; cleared on decision
    id_submitted_at = Column(DateTime, nullable=True)
    id_reviewed_at = Column(DateTime, nullable=True)
    id_reviewed_by = Column(String, nullable=True)               # officer name, snapshotted
    id_reject_reason = Column(String, nullable=True)

    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cases = relationship("Case", back_populates="user")
    otps = relationship("OTP", back_populates="user")

    @property
    def full_name(self):
        parts = [self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        parts.append(self.last_name)
        return " ".join(parts)
