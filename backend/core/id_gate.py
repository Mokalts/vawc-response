"""Reporting requires a verified ID.

Decided at the pre-final defense: an account must have an ID approved by a
barangay officer before the system will take a report from it. The purpose is to
keep dummy accounts out of the desk's records.

The cost is real and belongs in the project's limitations rather than hidden
here. An officer reviewing IDs is not on duty at two in the morning, so a woman
who signs up in the middle of an emergency cannot file until someone clears her
paperwork. Her options in the meantime are the hotlines, which the app shows
without an account, and going to the barangay hall in person. The barangay's
duty to act on a VAWC complaint under RA 9262 does not itself depend on her
producing identification; this gate is a property of this system, not of the law
it supports.

The refusal therefore has to do two things: say plainly what is blocking her,
and point at help that does not wait for an officer.
"""
from fastapi import HTTPException

MESSAGES = {
    "none": (
        "Your ID has not been checked yet. Send one from your profile and the "
        "barangay VAWC desk will review it. If you are in danger now, call 911 "
        "or the hotlines on the home screen; they do not need an account."
    ),
    "pending": (
        "Your ID is still being checked by the barangay VAWC desk. If you are in "
        "danger now, call 911 or the hotlines on the home screen; they do not "
        "need an account."
    ),
    "rejected": (
        "The ID you sent was not accepted. Send another from your profile. If you "
        "are in danger now, call 911 or the hotlines on the home screen; they do "
        "not need an account."
    ),
}


def require_verified_id(user):
    """Refuse a report from an account whose ID is not approved."""
    status = getattr(user, "id_status", "none") or "none"
    if status == "approved":
        return
    raise HTTPException(
        status_code=403,
        detail=MESSAGES.get(status, MESSAGES["none"]),
        headers={"X-Id-Status": status},
    )
