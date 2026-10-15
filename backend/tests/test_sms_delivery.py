"""Getting a code to someone, when the channel that carries it is a phone.

The gateway is an Android handset on a desk. It can tell this server that a
message was accepted and nothing after that, which is the fact most of these
tests exist to respect.
"""
import types

import pytest

import utils.otp_helper as oh
import routers.auth as ra
from core.config import settings


@pytest.fixture()
def sent():
    """Captures what would have gone to the provider."""
    class Calls(list):
        """A list that can also carry the stand-in, so a test can set its
        status code without a second fixture."""

    calls = Calls()

    class Resp:
        def __init__(self, code=200, text="{}"):
            self.status_code = code
            self.text = text

    def post(url, **kw):
        calls.append((url, kw))
        return Resp(post.code, post.text)

    post.code, post.text = 200, "{}"
    original = oh.requests
    oh.requests = types.SimpleNamespace(post=post)
    calls.post = post
    yield calls
    oh.requests = original


@pytest.fixture(autouse=True)
def _default_sms_config():
    keep = {k: getattr(settings, k, None) for k in
            ("SMS_ENABLED", "SMS_PROVIDER", "SMS_API_KEY", "SMS_SENDER",
             "TEXTBEE_API_KEY", "TEXTBEE_DEVICE_ID", "TEXTBEE_SIM_ID")}
    settings.SMS_ENABLED = True
    settings.SMS_PROVIDER = "textbee"
    settings.TEXTBEE_API_KEY = "test-key"
    settings.TEXTBEE_DEVICE_ID = ""
    settings.TEXTBEE_SIM_ID = ""
    yield
    for k, v in keep.items():
        setattr(settings, k, v)


# ── Numbers ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw", [
    "09171234567", "639171234567", "9171234567",
    "0917 123 4567", "+63 917-123-4567",
])
def test_every_way_of_writing_a_number_reaches_the_same_one(raw):
    """textbee hands the number to Android's own SMS stack, which treats a bare
    09xxxxxxxxx as local and usually gets it right. Usually is not good enough
    for a verification code."""
    assert oh._e164_ph(raw) == "+639171234567"


def test_semaphore_still_gets_the_local_form():
    assert oh._normalize_ph_number("+639171234567") == "639171234567"
    assert oh._normalize_ph_number("9171234567") == "09171234567"


def test_a_logged_number_is_masked():
    """Render keeps these lines. A server log is a reasonable place to learn
    that an SMS failed and an unreasonable place to learn who was texted."""
    masked = oh._mask("09171234567")
    assert masked.startswith("0917")
    assert masked.endswith("567")
    assert "1234" not in masked


# ── The switch ──────────────────────────────────────────────────────────────

def test_nothing_is_attempted_while_sms_is_switched_off(sent):
    settings.SMS_ENABLED = False
    assert oh.sms_enabled() is False
    assert oh.send_sms("09171234567", "hi") is False
    assert sent == []


def test_a_key_without_the_switch_is_still_off(sent):
    settings.SMS_ENABLED = False
    assert oh.send_sms("09171234567", "hi") is False
    assert sent == []


def test_the_selected_provider_decides_which_key_counts(sent):
    settings.SMS_PROVIDER = "semaphore"
    settings.SMS_API_KEY = ""
    assert oh.sms_enabled() is False, "a textbee key must not enable semaphore"


# ── Sending ─────────────────────────────────────────────────────────────────

def test_textbee_gets_the_number_the_key_and_the_message(sent):
    assert oh.send_sms("09171234567", "code 123456") is True
    url, kw = sent[0]
    assert url == "https://api.textbee.dev/api/v1/gateway/send-sms"
    assert kw["headers"]["x-api-key"] == "test-key"
    assert kw["json"]["recipients"] == ["+639171234567"]
    assert kw["json"]["message"] == "code 123456"


def test_a_device_id_picks_the_device_scoped_route(sent):
    settings.TEXTBEE_DEVICE_ID = "dev99"
    oh.send_sms("09171234567", "hi")
    assert sent[0][0].endswith("/devices/dev99/send-sms")


@pytest.mark.parametrize("code", [400, 401, 403, 404, 429, 500])
def test_a_refusal_is_returned_not_raised(sent, code):
    sent.post.code = code
    assert oh.send_sms("09171234567", "hi") is False


def test_a_network_failure_is_swallowed():
    def boom(url, **kw):
        raise RuntimeError("connection reset")
    original, oh.requests = oh.requests, types.SimpleNamespace(post=boom)
    try:
        assert oh.send_sms("09171234567", "hi") is False
    finally:
        oh.requests = original


def test_an_unknown_provider_refuses_rather_than_guessing(sent):
    settings.SMS_PROVIDER = "textbe"
    assert oh.send_sms("09171234567", "hi") is False
    assert sent == []


# ── Which SIM ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("good", ["1", "2", "3", "24"])
def test_a_subscription_id_is_passed_through(sent, good):
    settings.TEXTBEE_SIM_ID = good
    oh.send_sms("09171234567", "hi")
    assert sent[0][1]["json"]["simSubscriptionId"] == int(good)


@pytest.mark.parametrize("bad", [
    "09276795700", "639276795700", "+639276795700", "sim1", "1.5", "-2", "12345",
])
def test_anything_that_is_not_a_subscription_id_is_refused(sent, bad):
    """A phone number parses as an integer, and that is the mistake this setting
    invites. textbee does not check the id against the phone, so a wrong one is
    ignored and the handset sends from whichever SIM it likes, which looks
    exactly like the problem the setting was added to solve."""
    settings.TEXTBEE_SIM_ID = bad
    assert oh.send_sms("09171234567", "hi") is True, "the send still goes"
    assert "simSubscriptionId" not in sent[0][1]["json"]


# ── The message, and the other channel ──────────────────────────────────────

def test_the_otp_text_fits_one_segment_and_warns_her(sent):
    oh.send_otp_sms("09171234567", "482915")
    msg = sent[0][1]["json"]["message"]
    assert "482915" in msg
    assert "Do not share" in msg
    assert len(msg) <= 160


@pytest.mark.parametrize("sms_result", [True, False, RuntimeError("down")])
def test_the_email_always_goes_whatever_the_text_did(monkeypatch, sms_result):
    """An accepted SMS is not a delivered one. The phone can be out of load, out
    of signal, switched off, or unable to choose between two SIMs, and every one
    of those fails after the API call has already returned 201.

    Sending the email only when SMS returned false made that the worst case in
    the system: she was told a code had been sent, and no code existed anywhere
    she could reach.
    """
    emails, texts = [], []

    def fake_sms(phone, code):
        texts.append(phone)
        if isinstance(sms_result, Exception):
            raise sms_result
        return sms_result

    monkeypatch.setattr(ra, "send_otp_sms", fake_sms)
    monkeypatch.setattr(ra, "send_otp_email", lambda e, c, verify_link=None: emails.append(e))
    monkeypatch.setattr(ra, "create_verify_token", lambda uid: "tok")

    user = types.SimpleNamespace(id=1, email="maria@example.com", phone_number="09171234567")
    ra._deliver_code(user, "123456", prefer_sms=True)

    assert texts == ["09171234567"]
    assert emails == ["maria@example.com"]


def test_registration_does_not_text_as_well(monkeypatch, client, sent):
    """Texting the code at registration left her on a screen offering to send it
    by SMS for something she already had, and pressing that issued a SECOND code
    which retired the first."""
    monkeypatch.setattr(ra, "send_otp_email", lambda *a, **k: None)
    r = client.post("/auth/register", json={
        "first_name": "Maria", "last_name": "Cruz", "email": "maria@example.com",
        "phone_number": "09171234567", "address": "14 Rizal Street",
        "password": "Passw0rd!", "is_minor": False,
    })
    assert r.status_code == 201
    assert sent == [], "the text is sent when she asks for it, not before"
