"""Deleting an account: what stops working, what survives, and what is kept.

Every test here is a bug that was live in production, not a hypothetical.
"""
from datetime import datetime, timedelta

import pytest

import routers.users as ru
import routers.admin_users as rau
from models.user import User
from models.case import Case
from models.case_activity import CaseActivity
from models.deletion_record import DeletionRecord


@pytest.fixture(autouse=True)
def destroyed_photos(monkeypatch):
    """No email, no Cloudinary. Records the destroyed photographs."""
    destroyed = []
    monkeypatch.setattr(ru, "destroy_image", lambda pid: destroyed.append(pid) or True)
    monkeypatch.setattr(rau, "destroy_image", lambda pid: destroyed.append(pid) or True)
    monkeypatch.setattr(ru, "notify_account_change", lambda *a, **k: None)
    monkeypatch.setattr(rau, "notify_account_change", lambda *a, **k: None)
    yield destroyed


def _token(client, email="maria@example.com"):
    r = client.post("/auth/login", json={"email": email, "password": "Passw0rd!"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _case(db, user, number="C-1"):
    c = Case(user_id=user.id, case_number=number, offender_name="Juan Dela Cruz")
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


# ── Her own deletion ────────────────────────────────────────────────────────

def test_her_session_stops_working_the_moment_she_deletes(client, make_user):
    """The dialog promises she is signed out immediately. It has to be true.

    get_current_user did not check is_deleted, so only the browser's copy of the
    token was thrown away while the token itself stayed valid until it expired.
    """
    make_user(id_document=None)
    token = _token(client)
    auth = {"Authorization": f"Bearer {token}"}

    assert client.get("/users/me", headers=auth).status_code == 200
    assert client.delete("/users/me", headers=auth).status_code == 200
    assert client.get("/users/me", headers=auth).status_code == 401


def test_the_id_photograph_goes_with_the_account(client, db, make_user, destroyed_photos):
    u = make_user(id_document="vawc/ids/user_1")
    client.delete("/users/me", headers={"Authorization": f"Bearer {_token(client)}"})

    assert destroyed_photos == ["vawc/ids/user_1"]
    db.expire_all()
    assert db.query(User).get(u.id).id_document is None


def test_the_account_is_only_soft_deleted(client, db, make_user):
    u = make_user(id_document=None)
    client.delete("/users/me", headers={"Authorization": f"Bearer {_token(client)}"})

    db.expire_all()
    row = db.query(User).get(u.id)
    assert row is not None, "reports are evidence; the row has to stay"
    assert row.is_deleted is True


# ── Recovery ────────────────────────────────────────────────────────────────

def test_recovery_restores_the_account(client, make_user):
    make_user(id_document=None)
    client.delete("/users/me", headers={"Authorization": f"Bearer {_token(client)}"})

    r = client.post("/users/recover",
                    json={"email": "maria@example.com", "password": "Passw0rd!"})
    assert r.status_code == 200
    assert client.post("/auth/login",
                       json={"email": "maria@example.com", "password": "Passw0rd!"}
                       ).status_code == 200


def test_recovery_does_not_reveal_who_has_an_account(client, make_user):
    """404 for an unknown email against 401 for a wrong password told anyone who
    asked whether a given woman had an account here."""
    make_user(id_document=None)

    unknown = client.post("/users/recover",
                          json={"email": "nobody@example.com", "password": "Whatever1!"})
    wrong_pw = client.post("/users/recover",
                           json={"email": "maria@example.com", "password": "Wrong1!"})

    assert unknown.status_code == wrong_pw.status_code == 401
    assert unknown.json()["detail"] == wrong_pw.json()["detail"]


def test_recovery_is_rate_limited(client, make_user):
    """It takes an email and a password and is open to anyone, so it is a login
    in everything but name. Without a brake it was the one unguarded place to
    guess a password."""
    make_user(id_document=None)
    codes = [
        client.post("/users/recover",
                    json={"email": "maria@example.com", "password": f"Bad{i}!"}).status_code
        for i in range(12)
    ]
    assert 429 in codes


# ── The officer's view ──────────────────────────────────────────────────────

def test_deleted_victims_lists_accounts_past_the_window(client, db, make_user, as_officer):
    """Filtering on deleted_at >= 30 days created accounts nobody could reach:
    gone from the list, still in the database, and sign-in told her they were
    permanently deleted when nothing had deleted them."""
    recent = make_user("a@example.com", is_deleted=True,
                       deleted_at=datetime.utcnow() - timedelta(days=3))
    old = make_user("b@example.com", is_deleted=True,
                    deleted_at=datetime.utcnow() - timedelta(days=40))
    undated = make_user("c@example.com", is_deleted=True, deleted_at=None)

    rows = {r["id"]: r for r in client.get("/admin/users/deleted").json()}

    assert {recent.id, old.id, undated.id} <= set(rows)
    assert rows[recent.id]["recovery_expired"] is False
    assert rows[old.id]["recovery_expired"] is True
    assert rows[undated.id]["recovery_expired"] is False, \
        "an unknown date is not evidence the window closed"


def test_officer_recovery_respects_the_window(client, make_user, as_officer):
    recent = make_user("a@example.com", is_deleted=True,
                       deleted_at=datetime.utcnow() - timedelta(days=3))
    old = make_user("b@example.com", is_deleted=True,
                    deleted_at=datetime.utcnow() - timedelta(days=40))

    assert client.patch(f"/admin/users/{recent.id}/recover").status_code == 200
    expired = client.patch(f"/admin/users/{old.id}/recover")
    assert expired.status_code == 410
    assert "recovery window" in expired.json()["detail"]


# ── Permanent deletion ──────────────────────────────────────────────────────

def test_force_delete_needs_the_accounts_own_email(client, db, make_user, as_officer):
    u = make_user("a5@example.com", is_deleted=True,
                  deleted_at=datetime.utcnow() - timedelta(days=40))

    for wrong in ("", "someone@example.com"):
        r = client.request("DELETE", f"/admin/users/{u.id}/force",
                           json={"confirm_email": wrong})
        assert r.status_code == 400
    db.expire_all()
    assert db.query(User).get(u.id) is not None


def test_force_delete_removes_the_case_and_its_activity_trail(
    client, db, make_user, as_officer, destroyed_photos
):
    """case_activities is the only child of cases without a cascade, so deleting
    a case out from under its audit rows raised a foreign key error and rolled
    the whole thing back."""
    u = make_user("a5@example.com", is_deleted=True,
                  deleted_at=datetime.utcnow() - timedelta(days=40),
                  id_document="vawc/ids/user_a5")
    c = _case(db, u)
    db.add(CaseActivity(case_id=c.id, admin_id=as_officer.id,
                        admin_name="Ana Reyes", action="status_changed", detail="Opened"))
    db.commit()
    # Held before the row goes: afterwards the ORM object cannot be refreshed.
    uid = u.id

    r = client.request("DELETE", f"/admin/users/{uid}/force",
                       json={"confirm_email": "A5@Example.com "})
    assert r.status_code == 200, r.text

    db.expire_all()
    assert db.query(User).get(uid) is None
    assert db.query(Case).filter(Case.user_id == uid).count() == 0
    assert db.query(CaseActivity).count() == 0
    assert destroyed_photos == ["vawc/ids/user_a5"]


def test_the_deletion_records_itself(client, db, make_user, as_officer):
    """An audit trail erased by the act it records is not an audit trail."""
    u = make_user("a5@example.com", is_deleted=True,
                  deleted_at=datetime.utcnow() - timedelta(days=40))
    _case(db, u, number="2026-014")
    uid = u.id

    client.request("DELETE", f"/admin/users/{uid}/force",
                   json={"confirm_email": "a5@example.com"})

    rec = db.query(DeletionRecord).filter(DeletionRecord.subject_id == uid).one()
    assert rec.kind == "victim_account"
    assert rec.case_numbers == "2026-014"
    assert rec.case_count == 1
    assert rec.admin_name == "Ana Reyes"

    everything = " ".join(str(getattr(rec, c.name)) for c in rec.__table__.columns)
    assert "Maria" not in everything, "she asked to be erased"
    assert "@" not in everything


def test_a_live_account_cannot_be_force_deleted(client, make_user, as_officer):
    u = make_user("a6@example.com")
    r = client.request("DELETE", f"/admin/users/{u.id}/force",
                       json={"confirm_email": "a6@example.com"})
    assert r.status_code == 404
