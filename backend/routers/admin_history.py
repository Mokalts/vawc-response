"""The whole trail, in one place, for whoever is answerable for it.

Three records already existed and none of them could be read together. The case
activity trail answers "what happened to this case" but only one case at a
time. The deletion records answer "what was permanently removed" and live in a
different table. ID decisions sit as fields on the account itself.

An officer asking "what did we do last Tuesday", or a Super Admin asking "who
closed that case", had to open each case in turn and hope. This joins them.

Super Admin only, deliberately. The log says who did what. Shown to everyone it
becomes a way to watch colleagues; shown to the person answerable for the desk
it is accountability. That is the same reason the Terms say actions are
attributed, not published.

It is read-only, and there is no endpoint anywhere that edits or removes a row.
A log an officer can edit is not a log.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.admin_dependencies import require_super_admin
from core.timeutil import ph_local_to_utc
from database import get_db
from models.admin import Admin
from models.case import Case
from models.case_activity import CaseActivity
from models.deletion_record import DeletionRecord
from models.user import User
from routers.admin_cases import ACTIVITY_LABELS

router = APIRouter(prefix="/admin/history", tags=["Admin History"])

# What a row is about, so the page can colour and filter without parsing labels.
KIND_CASE = "case"
KIND_DELETION = "deletion"
KIND_ID = "id_review"


def _iso(dt):
    return dt.isoformat() if dt else None


@router.get("")
def history(
    days: int = Query(30, ge=1, le=365, description="How far back to look, in days"),
    kind: Optional[str] = Query(None, description="case | deletion | id_review"),
    officer: Optional[str] = Query(None, description="Match part of an officer's name"),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    _: Admin = Depends(require_super_admin),
):
    """Everything recorded in the window, newest first.

    Bounded by a window and a limit rather than paged. The question this answers
    is "what has been happening", which is a recent-past question; an officer
    looking for one specific old event has the case's own trail for that.
    """
    since = datetime.utcnow() - timedelta(days=days)
    entries = []

    # ── What officers did to cases ──────────────────────────────────────────
    if kind in (None, KIND_CASE):
        rows = (
            db.query(CaseActivity, Case.case_number)
            .outerjoin(Case, Case.id == CaseActivity.case_id)
            .filter(CaseActivity.created_at >= since)
            .order_by(CaseActivity.created_at.desc())
            .limit(limit)
            .all()
        )
        for activity, case_number in rows:
            entries.append({
                "kind": KIND_CASE,
                "action": activity.action,
                "label": ACTIVITY_LABELS.get(
                    activity.action, activity.action.replace("_", " ").capitalize()),
                "detail": activity.detail,
                "subject": case_number or f"case {activity.case_id}",
                "case_id": activity.case_id,
                "by": activity.admin_name or "Unknown officer",
                "at": _iso(activity.created_at),
            })

    # ── What was permanently removed ────────────────────────────────────────
    # Kept even though the case trail is gone with it: this is the only record
    # that the thing ever existed.
    if kind in (None, KIND_DELETION):
        for rec in (
            db.query(DeletionRecord)
            .filter(DeletionRecord.created_at >= since)
            .order_by(DeletionRecord.created_at.desc())
            .limit(limit)
            .all()
        ):
            noun = "account" if rec.kind == "victim_account" else "case"
            entries.append({
                "kind": KIND_DELETION,
                "action": "permanently_deleted",
                "label": f"Permanently deleted an {noun}" if noun == "account"
                         else "Permanently deleted a case",
                "detail": (f"{rec.case_count} case(s): {rec.case_numbers}"
                           if rec.case_numbers else None),
                "subject": rec.case_numbers or f"{noun} {rec.subject_id}",
                "case_id": None,
                "by": rec.admin_name or "Unknown officer",
                "at": _iso(rec.created_at),
            })

    # ── ID decisions ────────────────────────────────────────────────────────
    # These live as fields on the account rather than as their own rows, so
    # only the latest decision per account exists to report. Said plainly here
    # rather than implying a history that is not kept.
    if kind in (None, KIND_ID):
        for user in (
            db.query(User)
            .filter(User.id_reviewed_at.isnot(None), User.id_reviewed_at >= since)
            .order_by(User.id_reviewed_at.desc())
            .limit(limit)
            .all()
        ):
            approved = (user.id_status or "") == "approved"
            entries.append({
                "kind": KIND_ID,
                "action": "id_approved" if approved else "id_rejected",
                "label": "ID approved" if approved else "ID not accepted",
                "detail": None if approved else (user.id_reject_reason or None),
                "subject": user.full_name,
                "case_id": None,
                "by": user.id_reviewed_by or "Unknown officer",
                "at": _iso(user.id_reviewed_at),
            })

    if officer:
        needle = officer.strip().lower()
        entries = [e for e in entries if needle in (e["by"] or "").lower()]

    entries.sort(key=lambda e: e["at"] or "", reverse=True)
    entries = entries[:limit]

    return {
        "count": len(entries),
        "days": days,
        # So the page can say what it is NOT showing, rather than letting the
        # officer assume the list is everything.
        "truncated": len(entries) >= limit,
        "entries": entries,
    }


@router.get("/officers")
def officers_seen(
    days: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
    _: Admin = Depends(require_super_admin),
):
    """Names that appear in the window, for the filter.

    Taken from the trail rather than the admin list, because the trail holds
    snapshotted names and an officer who has since left still appears in it.
    """
    since = datetime.utcnow() - timedelta(days=days)
    names = set()
    for (name,) in db.query(CaseActivity.admin_name).filter(
        CaseActivity.created_at >= since, CaseActivity.admin_name.isnot(None)
    ).distinct():
        names.add(name)
    for (name,) in db.query(DeletionRecord.admin_name).filter(
        DeletionRecord.created_at >= since, DeletionRecord.admin_name.isnot(None)
    ).distinct():
        names.add(name)
    return sorted(names)
