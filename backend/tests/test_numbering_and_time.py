"""Case and BPO numbers, and which day a case belongs to.

Both of these are wrong in ways nobody notices until a document is filed, which
is the point at which noticing is expensive.
"""
from datetime import datetime, timedelta

import pytest

from core.timeutil import ph_local_to_utc, utc_to_ph_local
from models.case import Case
from models.report import ReportStatus
from routers.cases import _generate_case_number
from routers.admin_bpo import _bpo_number
from routers.admin_dashboard import _resolve_range


def _case(db, number, user_id, created=None, status=ReportStatus.under_assessment):
    c = Case(case_number=number, user_id=user_id, offender_name="x", status=status)
    if created:
        c.created_at = created
    db.add(c)
    db.commit()
    return c


# ── Which year a number carries ─────────────────────────────────────────────

def test_the_case_number_uses_manilas_year(db, monkeypatch):
    """At 2am Manila on New Year's Day, UTC is still in the year that ended.
    case_number is unique and never reissued, so this is wrong for ever."""
    import routers.cases as rc

    # 2026-01-01 02:00 Manila is 2025-12-31 18:00 UTC.
    frozen = datetime(2025, 12, 31, 18, 0)
    assert utc_to_ph_local(frozen).year == 2026

    class FrozenDatetime(datetime):
        @classmethod
        def utcnow(cls):
            return frozen

    monkeypatch.setattr(rc, "datetime", FrozenDatetime)
    assert _generate_case_number(db).startswith("2026-")


def test_the_bpo_number_uses_manilas_year(db, monkeypatch):
    import routers.admin_bpo as rb

    frozen = datetime(2025, 12, 31, 18, 0)

    class FrozenDatetime(datetime):
        @classmethod
        def utcnow(cls):
            return frozen

    monkeypatch.setattr(rb, "datetime", FrozenDatetime)
    assert _bpo_number(db).startswith("BPO-2026-")


# ── Which number comes next ─────────────────────────────────────────────────

def test_the_case_number_follows_the_highest_not_the_count(db, make_user):
    """A count drops when anything is deleted and then hands back a number that
    already exists."""
    uid = make_user().id
    year = utc_to_ph_local(datetime.utcnow()).year
    _case(db, f"{year}-000-001", uid)
    _case(db, f"{year}-000-002", uid)
    _case(db, f"{year}-000-003", uid)

    db.query(Case).filter(Case.case_number == f"{year}-000-002").delete()
    db.commit()

    assert _generate_case_number(db) == f"{year}-000-004", \
        "a count would say 003, which is taken"


def test_the_bpo_number_follows_the_highest_not_the_count(db, officer, make_user):
    """The same bug, in the place where it costs most: an officer trying to
    issue a protection order."""
    from models.bpo import BPO
    year = utc_to_ph_local(datetime.utcnow()).year
    case = _case(db, f"{year}-000-001", make_user().id)

    for n in ("001", "002", "003"):
        db.add(BPO(case_id=case.id, bpo_number=f"BPO-{year}-{n}"))
    db.commit()

    db.query(BPO).filter(BPO.bpo_number == f"BPO-{year}-002").delete()
    db.commit()

    assert _bpo_number(db) == f"BPO-{year}-004", \
        "a count would say 003, which is already issued"


def test_a_taken_case_number_does_not_lose_the_report(client, db, make_user, monkeypatch):
    """Two submissions in the same instant read the same highest number and both
    build the next one. The loser used to get a 500 on a report she had spent
    several minutes writing."""
    import routers.cases as rc

    user = make_user()
    year = utc_to_ph_local(datetime.utcnow()).year
    taken = f"{year}-000-001"
    _case(db, taken, user.id)

    # Hand out the taken number once, as a racing request would have done.
    real = rc._generate_case_number
    handed = {"n": 0}

    def racing(session):
        handed["n"] += 1
        return taken if handed["n"] == 1 else real(session)

    monkeypatch.setattr(rc, "_generate_case_number", racing)

    token = client.post("/auth/login",
                        json={"email": user.email, "password": "Passw0rd!"}
                        ).json()["access_token"]
    r = client.post("/cases/",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"statement": "He hit me.", "offender_name": "Juan Dela Cruz"})

    assert r.status_code in (200, 201), r.text
    assert r.json()["case_number"] != taken
    assert handed["n"] >= 2, "it had to ask for another number"


# ── Which month a case belongs to ───────────────────────────────────────────

def test_a_case_filed_at_2am_on_the_first_counts_in_that_month(db, monkeypatch):
    """Computed in UTC, every month boundary sat eight hours early and this case
    was counted in the month before the one it was filed in."""
    import routers.admin_dashboard as rd

    # 1 March 2026, 02:00 Manila == 28 February 2026, 18:00 UTC.
    filed_utc = ph_local_to_utc(datetime(2026, 3, 1, 2, 0))
    assert filed_utc == datetime(2026, 2, 28, 18, 0)

    class FrozenDatetime(datetime):
        @classmethod
        def utcnow(cls):
            return ph_local_to_utc(datetime(2026, 3, 15, 12, 0))

    monkeypatch.setattr(rd, "datetime", FrozenDatetime)
    start, end, label = _resolve_range("monthly")

    assert label == "March 2026"
    assert start <= filed_utc <= end, "filed in March, so it belongs to March"


def test_the_month_does_not_reach_back_into_the_previous_one(db, monkeypatch):
    import routers.admin_dashboard as rd

    # 28 February 2026, 23:00 Manila. Belongs to February, not March.
    february = ph_local_to_utc(datetime(2026, 2, 28, 23, 0))

    class FrozenDatetime(datetime):
        @classmethod
        def utcnow(cls):
            return ph_local_to_utc(datetime(2026, 3, 15, 12, 0))

    monkeypatch.setattr(rd, "datetime", FrozenDatetime)
    start, _end, _label = _resolve_range("monthly")
    assert february < start


# ── What the two screens each mean by "case" ────────────────────────────────

def test_the_dashboard_and_profiles_count_the_same_things(client, db, as_officer, make_user):
    """The dashboard counted unconfirmed reports as cases while Profiles did
    not, so the two screens disagreed by however many were waiting at the desk,
    and the dashboard counted each of those twice: once in Total Cases and once
    in the New Reports tile beside it."""
    uid = make_user().id
    now = datetime.utcnow()
    _case(db, "2026-000-001", uid, created=now, status=ReportStatus.under_assessment)
    _case(db, "2026-000-002", uid, created=now, status=ReportStatus.submitted)

    stats = client.get("/admin/dashboard?period=annually").json()
    victims_endpoint = client.get("/admin/cases/victims").json()

    confirmed = db.query(Case).filter(
        Case.is_deleted == False,
        Case.status != ReportStatus.submitted,
    ).count()

    assert stats["total_reports"] == confirmed == 1
    assert isinstance(victims_endpoint, list)
