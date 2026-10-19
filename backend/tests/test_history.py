"""The admin history log: what it joins, what it hides, and who may read it."""
from datetime import datetime, timedelta

import pytest

import main
from models.admin import Admin
from models.case import Case
from models.case_activity import CaseActivity
from models.deletion_record import DeletionRecord
from models.report import ReportStatus


@pytest.fixture()
def as_super(officer, db):
    """Super Admin only: the log says who did what, and that is for the person
    answerable for the desk rather than for watching colleagues."""
    from core.admin_dependencies import require_super_admin
    oid = officer.id

    def _current():
        from database import SessionLocal
        s = SessionLocal()
        try:
            return s.query(Admin).get(oid)
        finally:
            s.close()

    main.app.dependency_overrides[require_super_admin] = _current
    yield officer
    main.app.dependency_overrides.pop(require_super_admin, None)


def _case(db, user_id, number="2026-000-001"):
    c = Case(case_number=number, user_id=user_id, offender_name="x",
             status=ReportStatus.under_assessment)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def test_a_plain_officer_cannot_read_it(client, officer, db):
    """No override here, so the real guard answers."""
    r = client.get("/admin/history")
    assert r.status_code in (401, 403)


def test_it_joins_the_three_records_that_were_separate(client, db, make_user, as_super):
    user = make_user()
    case = _case(db, user.id)

    db.add(CaseActivity(case_id=case.id, admin_id=as_super.id, admin_name="Ana Reyes",
                        action="status_changed", detail="Moved to Under Assessment"))
    db.add(DeletionRecord(kind="case", subject_id=99, case_numbers="2026-000-014",
                          case_count=1, admin_id=as_super.id, admin_name="Ana Reyes"))
    reviewed = make_user("rosa@example.com", id_status="approved",
                         id_reviewed_at=datetime.utcnow(), id_reviewed_by="Ana Reyes")
    db.commit()

    body = client.get("/admin/history").json()
    kinds = {e["kind"] for e in body["entries"]}
    assert kinds == {"case", "deletion", "id_review"}
    assert body["count"] == 3

    by_kind = {e["kind"]: e for e in body["entries"]}
    assert by_kind["case"]["subject"] == case.case_number
    assert by_kind["deletion"]["subject"] == "2026-000-014"
    assert by_kind["id_review"]["subject"] == reviewed.full_name


def test_newest_first(client, db, make_user, as_super):
    user = make_user()
    case = _case(db, user.id)
    old = CaseActivity(case_id=case.id, admin_name="Ana Reyes", action="status_changed")
    old.created_at = datetime.utcnow() - timedelta(days=2)
    new = CaseActivity(case_id=case.id, admin_name="Ana Reyes", action="message_sent")
    new.created_at = datetime.utcnow()
    db.add_all([old, new])
    db.commit()

    actions = [e["action"] for e in client.get("/admin/history").json()["entries"]]
    assert actions == ["message_sent", "status_changed"]


def test_the_window_excludes_older_entries(client, db, make_user, as_super):
    user = make_user()
    case = _case(db, user.id)
    stale = CaseActivity(case_id=case.id, admin_name="Ana Reyes", action="status_changed")
    stale.created_at = datetime.utcnow() - timedelta(days=60)
    db.add(stale)
    db.commit()

    assert client.get("/admin/history?days=30").json()["count"] == 0
    assert client.get("/admin/history?days=90").json()["count"] == 1


def test_it_can_be_narrowed_to_one_kind_and_one_officer(client, db, make_user, as_super):
    user = make_user()
    case = _case(db, user.id)
    db.add(CaseActivity(case_id=case.id, admin_name="Ana Reyes", action="status_changed"))
    db.add(CaseActivity(case_id=case.id, admin_name="Boy Santos", action="message_sent"))
    db.add(DeletionRecord(kind="case", subject_id=9, case_numbers="2026-000-002",
                          case_count=1, admin_name="Ana Reyes"))
    db.commit()

    only_cases = client.get("/admin/history?kind=case").json()["entries"]
    assert {e["kind"] for e in only_cases} == {"case"}

    only_ana = client.get("/admin/history?officer=ana").json()["entries"]
    assert all("Ana" in e["by"] for e in only_ana)
    assert len(only_ana) == 2


def test_it_says_when_it_is_not_showing_everything(client, db, make_user, as_super):
    """So an officer does not read a truncated list as the whole story."""
    user = make_user()
    case = _case(db, user.id)
    for i in range(6):
        db.add(CaseActivity(case_id=case.id, admin_name="Ana Reyes", action="status_changed"))
    db.commit()

    body = client.get("/admin/history?limit=3").json()
    assert body["count"] == 3
    assert body["truncated"] is True

    full = client.get("/admin/history?limit=50").json()
    assert full["truncated"] is False


def test_an_officer_who_has_left_still_appears(client, db, make_user, as_super):
    """Names are snapshotted on the trail, so the record of what somebody did
    outlives their account. The filter list is built from the trail for the
    same reason."""
    user = make_user()
    case = _case(db, user.id)
    db.add(CaseActivity(case_id=case.id, admin_id=None, admin_name="Departed Officer",
                        action="status_changed"))
    db.commit()

    assert "Departed Officer" in client.get("/admin/history/officers").json()
    entries = client.get("/admin/history").json()["entries"]
    assert entries[0]["by"] == "Departed Officer"


def test_a_deleted_case_leaves_the_fact_of_its_deletion(client, db, make_user, as_super):
    """Permanent deletion takes the case's own trail with it, because those
    rows point at the case. What survives is that somebody deleted it."""
    db.add(DeletionRecord(kind="victim_account", subject_id=7,
                          case_numbers="2026-000-031, 2026-000-032", case_count=2,
                          admin_name="Ana Reyes"))
    db.commit()

    entry = client.get("/admin/history?kind=deletion").json()["entries"][0]
    assert entry["label"] == "Permanently deleted an account"
    assert "2026-000-031" in entry["detail"]
    assert entry["by"] == "Ana Reyes"
