"""Cases nobody has touched.

The distinction this has to get right: a case is stale when no OFFICER has
acted, not when the row has not changed. A victim filing another report bumps
updated_at without anybody at the desk having looked at it, so a case can
appear busy and still be untouched. That is the case this exists to catch.
"""
from datetime import date, datetime, timedelta

import pytest

import main
from models.admin import Admin
from models.case import Case
from models.case_activity import CaseActivity
from models.report import ReportStatus
from models.user import User
from core.security import hash_password


@pytest.fixture()
def as_officer_full(officer):
    from core.admin_dependencies import get_current_admin_full_access
    from database import SessionLocal
    oid = officer.id

    def _current():
        s = SessionLocal()
        try:
            return s.query(Admin).get(oid)
        finally:
            s.close()

    main.app.dependency_overrides[get_current_admin_full_access] = _current
    yield officer
    main.app.dependency_overrides.pop(get_current_admin_full_access, None)


def _victim(db, n=0):
    u = User(first_name="Maria", last_name="Cruz%d" % n,
             email="m%d@example.com" % n, phone_number="0917000000%d" % n,
             address="14 Rizal Street", birthdate=date(1995, 3, 15),
             password_hash=hash_password("Passw0rd!"), is_verified=True,
             id_status="approved")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _case(db, user, number, created_days_ago=30,
          status=ReportStatus.under_assessment):
    c = Case(case_number=number, user_id=user.id, offender_name="x",
             status=status,
             created_at=datetime.utcnow() - timedelta(days=created_days_ago))
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def test_a_case_nobody_ever_touched_is_listed(client, db, as_officer_full):
    _case(db, _victim(db), "2026-000-001", created_days_ago=30)
    body = client.get("/admin/stale-cases?days=7").json()

    assert body["count"] == 1
    assert body["never_acted"] == 1
    assert body["cases"][0]["case_number"] == "2026-000-001"
    assert body["cases"][0]["days_idle"] >= 29


def test_a_case_acted_on_recently_is_not_listed(client, db, as_officer_full):
    c = _case(db, _victim(db), "2026-000-002", created_days_ago=30)
    db.add(CaseActivity(case_id=c.id, action="status_changed",
                        created_at=datetime.utcnow() - timedelta(days=1)))
    db.commit()

    assert client.get("/admin/stale-cases?days=7").json()["count"] == 0


def test_staleness_is_measured_from_the_last_officer_action(client, db, as_officer_full):
    """Not from created_at, once somebody has acted."""
    c = _case(db, _victim(db), "2026-000-003", created_days_ago=60)
    db.add(CaseActivity(case_id=c.id, action="status_changed",
                        created_at=datetime.utcnow() - timedelta(days=10)))
    db.commit()

    body = client.get("/admin/stale-cases?days=7").json()
    assert body["count"] == 1
    assert body["never_acted"] == 0
    assert 9 <= body["cases"][0]["days_idle"] <= 11


def test_finished_cases_are_left_alone(client, db, as_officer_full):
    """The barangay is done with these; listing them as neglected is noise."""
    v = _victim(db)
    _case(db, v, "2026-000-004", created_days_ago=90, status=ReportStatus.closed)
    _case(db, v, "2026-000-005", created_days_ago=90, status=ReportStatus.endorsed)

    assert client.get("/admin/stale-cases?days=7").json()["count"] == 0


def test_unconfirmed_reports_are_not_counted_here(client, db, as_officer_full):
    """Those belong to the New Reports tile, not to neglected casework."""
    _case(db, _victim(db), "2026-000-006", created_days_ago=30,
          status=ReportStatus.submitted)

    assert client.get("/admin/stale-cases?days=7").json()["count"] == 0


def test_deleted_cases_are_not_listed(client, db, as_officer_full):
    c = _case(db, _victim(db), "2026-000-007", created_days_ago=30)
    c.is_deleted = True
    db.commit()

    assert client.get("/admin/stale-cases?days=7").json()["count"] == 0


def test_the_longest_neglected_comes_first(client, db, as_officer_full):
    v = _victim(db)
    _case(db, v, "2026-000-008", created_days_ago=10)
    _case(db, v, "2026-000-009", created_days_ago=50)

    cases = client.get("/admin/stale-cases?days=7").json()["cases"]
    assert [c["case_number"] for c in cases] == ["2026-000-009", "2026-000-008"]


def test_the_window_is_adjustable_and_bounded(client, db, as_officer_full):
    _case(db, _victim(db), "2026-000-010", created_days_ago=10)

    assert client.get("/admin/stale-cases?days=30").json()["count"] == 0
    assert client.get("/admin/stale-cases?days=7").json()["count"] == 1
    assert client.get("/admin/stale-cases?days=0").status_code == 422
