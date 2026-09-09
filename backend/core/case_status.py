"""Derive a case's status from its records.

Used after a revert/undo so the case never gets stuck on a status whose
underlying record was removed (e.g. an accidentally-created BPO was deleted).
"""
from models.report import ReportStatus
from models.bpo import BPOStatus

ASSESSMENT_STATUSES = {
    ReportStatus.submitted,
    ReportStatus.under_assessment,
    ReportStatus.awaiting_onsite_visit,
}


def recompute_case_status(case) -> ReportStatus:
    # Closure wins while a closure reason is on record.
    if case.closure_reason and case.closed_at:
        return ReportStatus.closed
    if case.endorsements:
        return ReportStatus.endorsed
    bpos = case.bpos or []
    if any(b.status == BPOStatus.served for b in bpos):
        return ReportStatus.bpo_served
    if any(b.status == BPOStatus.issued for b in bpos):
        return ReportStatus.bpo_issued
    if any(b.status == BPOStatus.applied for b in bpos):
        return ReportStatus.bpo_applied
    # Nothing downstream left — fall back to where the assessment was.
    return case.status if case.status in ASSESSMENT_STATUSES else ReportStatus.under_assessment
