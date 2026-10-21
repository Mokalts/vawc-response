"""Which activity entries collapse, and which must not.

Two sources describe some events, so those are de-duplicated. Repeated
sign-ins are NOT the same thing: a second sign-in a moment after the first is
exactly what somebody checking for an intruder is looking for, and an earlier
version of this endpoint swallowed it.
"""
from datetime import date, datetime, timedelta

import pytest

import main
from models.user import User
from models.user_activity import UserActivity
from core.security import hash_password


def _user(db):
    u = User(first_name="Maria", last_name="Cruz", email="maria@example.com",
             phone_number="09171234567", address="14 Rizal Street",
             birthdate=date(1995, 3, 15), password_hash=hash_password("Passw0rd!"),
             is_verified=True, id_status="approved")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture()
def as_user(db):
    from core.dependencies import get_current_user
    from database import get_db
    u = _user(db)
    uid = u.id
    main.app.dependency_overrides[get_db] = lambda: db
    main.app.dependency_overrides[get_current_user] = lambda: db.query(User).get(uid)
    yield u
    main.app.dependency_overrides.pop(get_current_user, None)
    main.app.dependency_overrides.pop(get_db, None)


def test_two_sign_ins_in_the_same_minute_both_show(client, db, as_user):
    """The whole point of the screen is noticing a sign-in that was not her."""
    when = datetime(2026, 10, 21, 14, 52, 0)
    db.add(UserActivity(user_id=as_user.id, action="signed_in", created_at=when))
    db.add(UserActivity(user_id=as_user.id, action="signed_in",
                        created_at=when + timedelta(seconds=20)))
    db.commit()

    texts = [e["text"] for e in client.get("/users/me/activity").json()["entries"]]
    assert texts.count("Signed in") == 2


def test_a_sign_in_and_a_sign_out_together_both_show(client, db, as_user):
    when = datetime(2026, 10, 21, 14, 52, 0)
    db.add(UserActivity(user_id=as_user.id, action="signed_in", created_at=when))
    db.add(UserActivity(user_id=as_user.id, action="signed_out", created_at=when))
    db.commit()

    texts = [e["text"] for e in client.get("/users/me/activity").json()["entries"]]
    assert "Signed in" in texts and "Signed out" in texts


def test_the_double_sourced_id_submission_still_collapses(client, db, as_user):
    when = datetime(2026, 10, 21, 14, 52, 0)
    as_user.id_submitted_at = when
    db.add(UserActivity(user_id=as_user.id, action="id_submitted", created_at=when))
    db.commit()

    texts = [e["text"] for e in client.get("/users/me/activity").json()["entries"]]
    assert texts.count("ID sent for checking") == 1


def test_two_reports_on_different_cases_both_show(client, db, as_user):
    """They collapse only when they are the same event seen twice, which means
    the same case number as well as the same minute."""
    when = datetime(2026, 10, 21, 14, 52, 0)
    db.add(UserActivity(user_id=as_user.id, action="report_filed",
                        detail="2026-001-000", created_at=when))
    db.add(UserActivity(user_id=as_user.id, action="report_filed",
                        detail="2026-002-000", created_at=when))
    db.commit()

    texts = [e["text"] for e in client.get("/users/me/activity").json()["entries"]]
    assert texts.count("You filed a report") == 2
