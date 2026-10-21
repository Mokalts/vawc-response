"""Notification preferences, and the activity trail they sit beside.

The point of these is that the switches are not decorative. The old
Notifications toggle was useState(true) and nothing read it; these assert that
turning something off actually stops the send.
"""
from datetime import date, datetime

import pytest

import main
from models.admin import Admin
from models.case import Case
from models.report import ReportStatus
from models.user import User
from models.user_activity import UserActivity
from core.security import hash_password


def _user(db, **over):
    u = User(first_name="Maria", last_name="Cruz", email="maria@example.com",
             phone_number="09171234567", address="14 Rizal Street",
             birthdate=date(1995, 3, 15), password_hash=hash_password("Passw0rd!"),
             is_verified=True, id_status="approved")
    for k, v in over.items():
        setattr(u, k, v)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture()
def as_user(db):
    """Signed in as one woman.

    Both get_db and get_current_user are overridden onto the SAME session,
    because that is how the real app behaves: get_current_user depends on
    get_db, so the endpoint mutates a user that belongs to the session it then
    commits. Handing back a user from a session that is already closed would
    make every write here silently do nothing.
    """
    from core.dependencies import get_current_user
    from database import get_db
    u = _user(db)
    uid = u.id

    main.app.dependency_overrides[get_db] = lambda: db
    main.app.dependency_overrides[get_current_user] = lambda: db.query(User).get(uid)
    yield u
    main.app.dependency_overrides.pop(get_current_user, None)
    main.app.dependency_overrides.pop(get_db, None)


# ── Defaults ────────────────────────────────────────────────────────────────

def test_a_new_account_is_opted_in_to_everything_but_sms(client, db, as_user):
    """Which is how the app behaved before these columns existed."""
    body = client.get("/users/me/notifications").json()
    assert body["notify_enabled"] is True
    assert body["notify_email"] is True
    assert body["notify_case_updates"] is True
    assert body["notify_desk_messages"] is True
    assert body["notify_sms"] is False


def test_the_screen_is_told_whether_the_server_can_text_at_all(client, db, as_user):
    """So the SMS row can grey itself out rather than pretending."""
    assert "sms_available" in client.get("/users/me/notifications").json()


def test_a_preference_survives_being_set(client, db, as_user):
    client.patch("/users/me/notifications", json={"notify_case_updates": False})
    assert client.get("/users/me/notifications").json()["notify_case_updates"] is False


def test_sms_cannot_be_turned_on_while_the_server_cannot_send_it(client, db, as_user):
    """Otherwise she believes she is covered by a channel that is switched off."""
    body = client.patch("/users/me/notifications", json={"notify_sms": True}).json()
    if not body["sms_available"]:
        assert body["notify_sms"] is False


def test_security_mail_has_no_switch_at_all(client, db, as_user):
    """A woman who could turn off her own sign-in code could lock herself out
    of the account she needs in an emergency, so the field does not exist."""
    client.patch("/users/me/notifications", json={"notify_sign_in_codes": False})
    assert not hasattr(as_user, "notify_sign_in_codes")


# ── The switches actually gate the sends ────────────────────────────────────

def test_wants_blocks_a_case_update_when_she_turned_them_off(db):
    from routers.admin_cases import _wants
    u = _user(db, notify_case_updates=False)
    assert _wants(u, "notify_case_updates") is False
    assert _wants(u, "notify_desk_messages") is True


def test_the_master_switch_blocks_everything(db):
    from routers.admin_cases import _wants
    u = _user(db, notify_enabled=False)
    assert _wants(u, "notify_case_updates") is False
    assert _wants(u, "notify_desk_messages") is False


def test_turning_off_email_does_not_also_mute_sms(db):
    from routers.admin_cases import _wants
    u = _user(db, notify_email=False, notify_sms=True)
    assert _wants(u, "notify_desk_messages") is False
    assert _wants(u, "notify_desk_messages", "notify_sms") is True


def test_an_unmigrated_database_keeps_sending(db):
    """The columns default to True on lookup, so a deployment whose migration
    has not run yet behaves as it did before rather than going silent."""
    from routers.admin_cases import _wants

    class Bare:
        pass

    assert _wants(Bare(), "notify_case_updates") is True
    assert _wants(None, "notify_case_updates") is True


# ── Activity ────────────────────────────────────────────────────────────────

def test_the_trail_is_not_empty_for_an_account_that_predates_it(client, db, as_user):
    """Everything here comes from timestamps that already existed, which is
    what stops this screen being blank for every woman already registered."""
    body = client.get("/users/me/activity").json()
    assert any(e["text"] == "Account created" for e in body["entries"])


def test_her_own_actions_appear(client, db, as_user):
    db.add(UserActivity(user_id=as_user.id, action="signed_in", created_at=datetime.utcnow()))
    db.commit()
    texts = [e["text"] for e in client.get("/users/me/activity").json()["entries"]]
    assert "Signed in" in texts


def test_an_action_with_no_wording_is_not_shown(client, db, as_user):
    """The map is a whitelist, so a new officer action cannot start appearing
    on her phone just because somebody added it to the admin side."""
    db.add(UserActivity(user_id=as_user.id, action="something_internal",
                        created_at=datetime.utcnow()))
    db.commit()
    texts = [e["text"] for e in client.get("/users/me/activity").json()["entries"]]
    assert "something_internal" not in texts


def test_the_trail_is_newest_first(client, db, as_user):
    body = client.get("/users/me/activity").json()
    stamps = [e["at"] for e in body["entries"]]
    assert stamps == sorted(stamps, reverse=True)


def test_one_event_described_by_two_sources_appears_once(client, db, as_user):
    """An ID submission is both a logged action and a timestamp on the
    account."""
    when = datetime.utcnow()
    as_user.id_submitted_at = when
    db.add(UserActivity(user_id=as_user.id, action="id_submitted", created_at=when))
    db.commit()
    texts = [e["text"] for e in client.get("/users/me/activity").json()["entries"]]
    assert texts.count("ID sent for checking") == 1


def test_another_womans_activity_is_not_visible(client, db, as_user):
    other = _user(db, email="other@example.com", phone_number="09179999999")
    db.add(UserActivity(user_id=other.id, action="signed_in", detail="not hers",
                        created_at=datetime.utcnow()))
    db.commit()
    details = [e.get("detail") for e in client.get("/users/me/activity").json()["entries"]]
    assert "not hers" not in details


# ── The report receipt, which is the one that defaults off ──────────────────

def test_the_report_receipt_is_off_until_she_asks(client, db, as_user):
    """Mail landing in her inbox is a risk if the person she is reporting
    reads her mail, so this is the only preference that is opt-in."""
    assert client.get("/users/me/notifications").json()["notify_report_receipt"] is False


def test_she_can_turn_the_receipt_on(client, db, as_user):
    body = client.patch("/users/me/notifications",
                        json={"notify_report_receipt": True}).json()
    assert body["notify_report_receipt"] is True


def test_no_receipt_while_it_is_off(db):
    from routers.cases import wants_report_receipt
    assert wants_report_receipt(_user(db)) is False


def test_a_receipt_once_she_turns_it_on(db):
    from routers.cases import wants_report_receipt
    assert wants_report_receipt(_user(db, notify_report_receipt=True)) is True


def test_the_master_switch_also_silences_the_receipt(db):
    from routers.cases import wants_report_receipt
    assert wants_report_receipt(
        _user(db, notify_report_receipt=True, notify_enabled=False)) is False
    assert wants_report_receipt(
        _user(db, email="b@example.com", phone_number="09171111111",
              notify_report_receipt=True, notify_email=False)) is False


def test_an_unmigrated_database_sends_no_receipt(db):
    """The other preferences default to on when the column is missing; this
    one defaults to off, because the safe failure here is not sending."""
    from routers.cases import wants_report_receipt

    class Bare:
        pass

    assert wants_report_receipt(Bare()) is False
    assert wants_report_receipt(None) is False
