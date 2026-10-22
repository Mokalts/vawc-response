from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models.hotline import Hotline
from models.admin import Admin
from models.case_activity import CaseActivity  # noqa: F401  (mapper registration)
from core.admin_dependencies import get_current_admin_full_access

public_router = APIRouter(prefix="/hotlines", tags=["Hotlines"])
admin_router = APIRouter(prefix="/admin/hotlines", tags=["Hotlines (admin)"])


class HotlineIn(BaseModel):
    label:       str
    display:     str
    dial:        Optional[str] = None
    description: Optional[str] = None
    is_critical: bool = False
    is_test:     bool = False
    is_active:   bool = True
    sort_order:  int = 100


class HotlinePatch(BaseModel):
    label:       Optional[str] = None
    display:     Optional[str] = None
    dial:        Optional[str] = None
    description: Optional[str] = None
    is_critical: Optional[bool] = None
    is_test:     Optional[bool] = None
    is_active:   Optional[bool] = None
    sort_order:  Optional[int] = None


def _out(h: Hotline) -> dict:
    return {
        "id":          h.id,
        "label":       h.label,
        "dial":        h.dial,
        "display":     h.display,
        "description": h.description,
        "is_critical": h.is_critical,
        "is_test":     h.is_test,
        "is_active":   h.is_active,
        "sort_order":  h.sort_order,
    }


def _clean(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None


# ── Public ───────────────────────────────────────────────────────────────────
@public_router.get("")
@public_router.get("/")
def list_hotlines(db: Session = Depends(get_db)):
    """Every active hotline, in display order.

    Deliberately open: the hotlines are the one part of this app that must
    work for a woman with no account, not signed in, who may be about to close
    the page. Requiring a session here would put a login between her and 911.
    """
    rows = (
        db.query(Hotline)
        .filter(Hotline.is_active == True)
        .order_by(Hotline.is_critical.desc(), Hotline.sort_order, Hotline.id)
        .all()
    )
    return {"hotlines": [_out(h) for h in rows]}


# ── Admin ────────────────────────────────────────────────────────────────────
@admin_router.get("")
@admin_router.get("/")
def list_all(db: Session = Depends(get_db),
             current_admin: Admin = Depends(get_current_admin_full_access)):
    """Including the inactive ones, which the public list hides."""
    rows = (
        db.query(Hotline)
        .order_by(Hotline.is_critical.desc(), Hotline.sort_order, Hotline.id)
        .all()
    )
    return {"hotlines": [_out(h) for h in rows]}


@admin_router.post("", status_code=201)
@admin_router.post("/", status_code=201)
def create(payload: HotlineIn, db: Session = Depends(get_db),
           current_admin: Admin = Depends(get_current_admin_full_access)):
    label = _clean(payload.label)
    display = _clean(payload.display)
    if not label or not display:
        raise HTTPException(status_code=422, detail="A hotline needs a name and a number to show.")

    h = Hotline(
        label=label,
        display=display,
        dial=_clean(payload.dial),
        description=_clean(payload.description),
        is_critical=payload.is_critical,
        is_test=payload.is_test,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return _out(h)


@admin_router.patch("/{hotline_id}")
def update(hotline_id: int, payload: HotlinePatch, db: Session = Depends(get_db),
           current_admin: Admin = Depends(get_current_admin_full_access)):
    h = db.query(Hotline).filter(Hotline.id == hotline_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hotline not found.")

    data = payload.model_dump(exclude_unset=True)
    for field in ("label", "display", "dial", "description"):
        if field in data:
            value = _clean(data[field])
            if field in ("label", "display") and not value:
                raise HTTPException(status_code=422,
                                    detail="A hotline needs a name and a number to show.")
            setattr(h, field, value)
    for field in ("is_critical", "is_test", "is_active", "sort_order"):
        if field in data and data[field] is not None:
            setattr(h, field, data[field])

    db.commit()
    db.refresh(h)
    return _out(h)


@admin_router.delete("/{hotline_id}")
def remove(hotline_id: int, db: Session = Depends(get_db),
           current_admin: Admin = Depends(get_current_admin_full_access)):
    """Deleting is allowed, and the last one is not.

    The officers own this list, so they can remove a number that no longer
    exists. What they cannot do is empty the panel: a woman opening Hotlines
    and finding nothing there is worse than finding a number that has moved,
    because the blank panel tells her there is nobody to call.
    """
    h = db.query(Hotline).filter(Hotline.id == hotline_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hotline not found.")

    remaining = (
        db.query(Hotline)
        .filter(Hotline.id != hotline_id, Hotline.is_test == False)
        .count()
    )
    if remaining == 0:
        raise HTTPException(
            status_code=409,
            detail="This is the last hotline. Add another before removing this one - "
                   "the emergency panel must never be empty.",
        )

    db.delete(h)
    db.commit()
    return {"message": "Hotline removed."}
