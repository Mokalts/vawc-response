"""Shared display labels for the lawful VAWC flow. Single source of truth so the
admin routers, victim routers, and dashboard never drift. Never render
"Resolved", "Settled", or "Nag-areglo" anywhere."""

STATUS_DISPLAY = {
    "submitted":             "Submitted",
    "under_assessment":      "Under Assessment",
    "awaiting_onsite_visit": "Awaiting Onsite Visit",
    "bpo_applied":           "BPO Applied",
    "bpo_issued":            "BPO Issued",
    "bpo_served":            "BPO Served",
    "endorsed":              "Endorsed",
    # Under RA 9262 a VAWC case is a public crime and only a court can dismiss
    # or close it. What ends at the barangay is its ASSISTANCE, not the case, so
    # nothing user-facing says "Closed". The enum value stays `closed` (renaming
    # it would need a data migration for no benefit) — only the label changed.
    "closed":                "Assistance Ended",
}

# Victim-facing message per status transition (used in status emails).
STATUS_EMAIL_MSG = {
    "under_assessment":      "Your case is being assessed by the barangay VAWC office.",
    "awaiting_onsite_visit": "The barangay VAWC officer will conduct an onsite visit to investigate your case.",
    "bpo_applied":           "A Barangay Protection Order has been applied for in your case.",
    "bpo_issued":            "A Barangay Protection Order has been issued in your case. It is valid for 15 days.",
    "bpo_served":            "The Barangay Protection Order has been served to the respondent.",
    "endorsed":              "Your case has been endorsed to the appropriate authorities for further action.",
    "closed":                "The barangay has ended its assistance on your case and recorded the reason. This does not dismiss the case: only a court can do that, and you may still file with the police or the court. You can also ask the barangay to resume by filing a new report.",
}

# Wording verified against the NVAW Documentation System *Barangay Client Card*
# (Barangay VAW Desk Handbook, Annex A, printed p. 66). The card frames these as
# reasons recorded when "the victim does not want to continue or pursue the
# case" — reasons for non-pursuit, NOT case outcomes. The card offers no
# category for a case that ended well, which is why the last two below are
# documented additions rather than standard entries.
CLOSURE_REASON_DISPLAY = {
    # --- Verbatim from Annex A ---
    "lost_interest_to_file":          "Lost interest to file",
    "reconciled_without_mediation":   "Reconciled with the perpetrator (w/o mediation)",
    "transferred_residence":          "Transfer residence",
    "lack_of_support":                "Lack of support",
    "lack_of_confidence_in_provider": "Lack of confidence with service provider",
    "others":                         "Others (please specify)",
    # --- Additions (not in Annex A; barangay-level outcomes it does not model) ---
    "referred_and_completed":         "Referred and successfully turned over",
    "bpo_expired_no_incident":        "BPO expired with no further incident",
    # --- Migration only; never offered for new records ---
    "legacy_settled_at_barangay":     "Legacy record (settled at barangay, pre-system)",
}

# Reasons that came straight off Annex A, kept separate so the UI can show the
# provenance and the paper trail can be defended.
ANNEX_A_CLOSURE_REASONS = (
    "lost_interest_to_file",
    "reconciled_without_mediation",
    "transferred_residence",
    "lack_of_support",
    "lack_of_confidence_in_provider",
    "others",
)

RELATIONSHIP_DISPLAY = {
    "current_spouse_partner": "Current spouse / partner",
    "former_spouse_partner":  "Former spouse / partner",
    "current_dating":         "Current dating relationship",
    "former_dating":          "Former dating relationship",
    "employer_supervisor":    "Employer / supervisor",
    "agent_of_employer":      "Agent of employer",
    "teacher_instructor":     "Teacher / instructor",
    "coach_trainer":          "Coach / trainer",
    "person_of_authority":    "Person of authority",
    "neighbor_coworker":      "Neighbor / co-worker",
    "immediate_family":       "Immediate family",
    "other_relative":         "Other relative",
    "stranger":               "Stranger",
    "others":                 "Others",
}

SEVERITY_DISPLAY = {
    "low": "Low", "moderate": "Moderate", "high": "High", "critical": "Critical",
}

ENDORSEMENT_OFFICE_DISPLAY = {
    "pnp_iba_mps": "PNP - Iba MPS (Women & Children Protection Desk)",
    "cmswdo":      "C/MSWDO",
    "court":       "Court",
    "pao":         "PAO",
    "medical":     "Medical / Hospital",
    "others":      "Others",
}

# Statuses that mean the case is no longer active (for duplicate-check / filters).
CLOSED_STATUSES = {"endorsed", "closed"}


# ── Abuse types (RA 9262 forms of violence) ──────────────────────────────────
# Canonical ids. Everything stored or aggregated should reduce to one of these.
ABUSE_TYPES = ("physical", "sexual", "psychological", "economic", "others")

ABUSE_DISPLAY = {
    "physical":      "Physical Abuse",
    "sexual":        "Sexual Abuse",
    "psychological": "Psychological Abuse",
    "economic":      "Economic Abuse",
    "others":        "Other",
}

# Values written by pickers that predate the lawful-flow rebuild. Reports filed
# then stored title-case labels ("Physical Abuse") while the current intake
# stores ids ("physical"), so a breakdown grouped on the raw column splits one
# real category into two bars. Anything here folds back to a canonical id.
_ABUSE_ALIASES = {
    "physical abuse":            "physical",
    "sexual abuse":              "sexual",
    "psychological abuse":       "psychological",
    "psychological / emotional": "psychological",
    "psychological/emotional":   "psychological",
    "emotional abuse":           "psychological",
    "verbal abuse":              "psychological",
    "verbal/emotional abuse":    "psychological",
    "economic abuse":            "economic",
    "financial abuse":           "economic",
    "other":                     "others",
    "other abuse":               "others",
}


def canonical_abuse_type(raw):
    """Fold any stored abuse-type value to a canonical id.

    Returns None for empty input. An unrecognised value is returned normalised
    (trimmed, lower-cased, whitespace collapsed) rather than forced into
    "others", so unexpected data stays visible in the breakdown instead of
    being silently absorbed into a bucket it may not belong to.
    """
    if not raw:
        return None
    key = " ".join(str(raw).strip().lower().split())
    if not key:
        return None
    if key in ABUSE_DISPLAY:
        return key
    if key in _ABUSE_ALIASES:
        return _ABUSE_ALIASES[key]
    # Last resort: drop a trailing "abuse" and retry ("Physical  Abuse" etc.)
    stripped = key[:-5].strip() if key.endswith("abuse") else key
    if stripped in ABUSE_DISPLAY:
        return stripped
    return key


def abuse_label(raw):
    """Display label for any stored abuse-type value."""
    key = canonical_abuse_type(raw)
    if not key:
        return None
    return ABUSE_DISPLAY.get(key, key.title())
