from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base
from models.report import ReportStatus


# ── Case-level enums ──────────────────────────────────────────────────────────
class ClosureReason(str, enum.Enum):
    # First five + others taken from the NVAW DocS Barangay Client Card
    # (Handbook Annex A, printed p. 66), verified against the form. The card
    # records them when "the victim does not want to continue or pursue the
    # case" — reasons for non-pursuit, not outcomes.
    lost_interest_to_file          = "lost_interest_to_file"
    reconciled_without_mediation   = "reconciled_without_mediation"
    transferred_residence          = "transferred_residence"
    lack_of_support                = "lack_of_support"
    lack_of_confidence_in_provider = "lack_of_confidence_in_provider"
    others                         = "others"
    # Additions. Annex A has no category for a case that ended well, so a
    # successful referral or a protection order that held cannot be recorded
    # truthfully without these. Documented as a deviation, not as standard.
    referred_and_completed         = "referred_and_completed"
    bpo_expired_no_incident        = "bpo_expired_no_incident"
    # Migration only — must never appear in a dropdown for new cases.
    legacy_settled_at_barangay     = "legacy_settled_at_barangay"


class RelationshipToOffender(str, enum.Enum):
    # From NVAW DocS Annex A. Required to establish whether a case is RA 9262.
    current_spouse_partner   = "current_spouse_partner"
    former_spouse_partner    = "former_spouse_partner"
    current_dating           = "current_dating"
    former_dating            = "former_dating"
    employer_supervisor      = "employer_supervisor"
    agent_of_employer        = "agent_of_employer"
    teacher_instructor       = "teacher_instructor"
    coach_trainer            = "coach_trainer"
    person_of_authority      = "person_of_authority"
    neighbor_coworker        = "neighbor_coworker"
    immediate_family         = "immediate_family"
    other_relative           = "other_relative"
    stranger                 = "stranger"
    others                   = "others"


class Case(Base):
    __tablename__ = "cases"

    id                = Column(Integer, primary_key=True, index=True)
    case_number       = Column(String, unique=True, nullable=False)
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_id          = Column(Integer, ForeignKey("admins.id"), nullable=True)

    # Encrypted at API layer
    offender_name     = Column(String, nullable=False)
    # The respondent's own details, for the forms that have to carry them.
    # Every printed document already asks for these (the BPO reads "<name> of
    # <address>", and the complaint and Client Card ask for contact and age),
    # but nothing stored them, so an officer retyped the address on each form
    # and the same case could leave the desk with two different addresses on
    # two documents. A BPO also has to be SERVED on the respondent, and an
    # order carrying the wrong address is an order that never reaches him.
    # Stored encrypted like the name: he is a data subject under RA 10173 too,
    # and the lawful purpose here is issuing and serving the order.
    offender_address  = Column(String, nullable=True)   # ENCRYPTED
    offender_contact  = Column(String, nullable=True)   # ENCRYPTED
    offender_age      = Column(String, nullable=True)   # ENCRYPTED

    # Status lives on the Case
    status            = Column(
        SAEnum(ReportStatus, name="reportstatus", create_type=False),
        default=ReportStatus.submitted,
        nullable=False,
    )

    has_status_update = Column(Boolean, default=False, nullable=False)

    # Classification
    relationship_to_offender = Column(SAEnum(RelationshipToOffender, name="relationshiptooffender"), nullable=True)
    # Severity/triage was removed: it had no counterpart in the Handbook or in
    # any paper form the desk uses, and nothing downstream consumed it. The
    # column is left in the database (now nullable) so recorded values survive.

    # Closure (a case that ends is `closed` WITH a reason — never "resolved/settled")
    closure_reason           = Column(SAEnum(ClosureReason, name="closurereason"), nullable=True)
    closure_note             = Column(Text, nullable=True)
    closed_at                = Column(DateTime, nullable=True)
    closed_by_admin_id       = Column(Integer, ForeignKey("admins.id"), nullable=True)

    # Applicant, when the person applying is not the victim (BPO Application item 10)
    applicant_name           = Column(String, nullable=True)   # ENCRYPTED
    applicant_address        = Column(String, nullable=True)   # ENCRYPTED
    applicant_contact        = Column(String, nullable=True)   # ENCRYPTED
    applicant_relation       = Column(String, nullable=True)
    applicant_consent_note   = Column(Text, nullable=True)

    # Mandatory reporting to the PNP and C/MSWDO was removed from the system.
    # The duty itself still exists (Handbook p.29), it is simply not tracked here.
    # The four database columns are left in place rather than dropped, so any
    # dates already recorded are not destroyed; they are no longer read.

    # Free-text message from the Super Admin to the victim
    admin_message     = Column(Text, nullable=True)
    admin_message_at  = Column(DateTime, nullable=True)

    # Soft delete
    is_deleted        = Column(Boolean, default=False, nullable=False)
    delete_reason     = Column(Text, nullable=True)
    deleted_at        = Column(DateTime, nullable=True)
    admin_recovered   = Column(Boolean, default=False, nullable=False)

    created_at        = Column(DateTime, default=datetime.utcnow)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user         = relationship("User", back_populates="cases")
    handled_by   = relationship("Admin", foreign_keys=[admin_id], back_populates="handled_cases")
    reports      = relationship("Report", back_populates="case", cascade="all, delete-orphan")
    messages     = relationship("CaseMessage", back_populates="case", cascade="all, delete-orphan", order_by="CaseMessage.created_at")
    bpos         = relationship("BPO", back_populates="case", cascade="all, delete-orphan", order_by="BPO.created_at")
    children     = relationship("Child", back_populates="case", cascade="all, delete-orphan")
    endorsements = relationship("Endorsement", back_populates="case", cascade="all, delete-orphan", order_by="Endorsement.endorsement_number")
