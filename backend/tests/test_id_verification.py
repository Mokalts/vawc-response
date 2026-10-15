"""Reading an ID to fill the form in, and the gate that waits on an officer."""
import io

import pytest

import routers.auth as ra
from core.config import settings
from models.user import User

# A one-pixel PNG: a real image, without being worth reading.
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000100ffff03000006000557bfabd400"
    "00000049454e44ae426082"
)


def _upload(client, data=PNG, name="id.png", ctype="image/png"):
    return client.post("/auth/read-id", files={"file": (name, io.BytesIO(data), ctype)})


@pytest.fixture()
def reads(monkeypatch):
    """Stands in for the OCR service, so no quota is spent and no key is needed."""
    def _set(suggestions, found=True, reason=None):
        out = {"suggestions": suggestions, "text_found": found}
        if reason:
            out["reason"] = reason
        monkeypatch.setattr(ra, "read_id", lambda b, fn="id.jpg": out)
    return _set


# ── Reading ─────────────────────────────────────────────────────────────────

def test_it_offers_back_what_the_card_said(client, reads):
    reads({"first_name": "Maria", "last_name": "Cruz", "birthdate": "1995-03-15"})
    r = _upload(client)
    assert r.status_code == 200
    assert r.json()["suggestions"]["first_name"] == "Maria"
    assert r.json()["scanned"] is True


def test_it_answers_with_those_two_things_and_nothing_else(client, reads):
    """It is unauthenticated, so it must say nothing about any account."""
    reads({}, found=False, reason="unreadable")
    assert sorted(_upload(client).json().keys()) == ["scanned", "suggestions"]


def test_an_unreadable_photo_is_not_an_error(client, reads):
    """Any ID means no common layout. Partial and failed reads are the normal
    case, and none of them may stop her registering."""
    reads({}, found=False, reason="unreadable")
    r = _upload(client)
    assert r.status_code == 200
    assert r.json()["suggestions"] == {}
    assert r.json()["scanned"] is False


def test_with_no_ocr_key_it_simply_suggests_nothing(client):
    keep = settings.OCR_API_KEY
    settings.OCR_API_KEY = ""
    try:
        r = _upload(client)
        assert r.status_code == 200
        assert r.json()["suggestions"] == {}
    finally:
        settings.OCR_API_KEY = keep


def test_it_stores_nothing(client, reads, monkeypatch):
    """The endpoint it replaces uploaded the photograph before any account
    existed, which made an unauthenticated endpoint into a place to put images."""
    uploads = []
    import utils.cloudinary_helper as ch
    monkeypatch.setattr(ch, "upload_image", lambda *a, **k: uploads.append(a) or "x")
    reads({"first_name": "Maria"})
    _upload(client)
    assert uploads == []


def test_only_images_are_accepted(client, reads):
    reads({})
    assert _upload(client, b"%PDF-1.4", "id.pdf", "application/pdf").status_code == 400


def test_an_oversized_image_is_refused(client, reads):
    reads({})
    r = _upload(client, b"\x00" * (11 * 1024 * 1024), "big.png")
    assert r.status_code == 400
    assert "10MB" in r.json()["detail"]


def test_it_is_rate_limited(client, reads):
    """The OCR quota is spendable, and this endpoint is open to anyone."""
    reads({})
    codes = [_upload(client).status_code for _ in range(10)]
    assert 429 in codes


# ── The gate ────────────────────────────────────────────────────────────────

def test_a_new_account_starts_unverified(client, monkeypatch):
    monkeypatch.setattr(ra, "send_otp_email", lambda *a, **k: None)
    r = client.post("/auth/register", json={
        "first_name": "Maria", "last_name": "Cruz", "email": "maria@example.com",
        "phone_number": "09171234567", "address": "14 Rizal Street",
        "password": "Passw0rd!", "is_minor": False,
    })
    assert r.status_code == 201
    assert r.json()["id_status"] == "none"


def test_registration_hands_back_a_token_for_the_photograph(client, monkeypatch):
    """The form uploads the ID on the same button press, and until the account
    exists there is nothing to attach it to."""
    monkeypatch.setattr(ra, "send_otp_email", lambda *a, **k: None)
    r = client.post("/auth/register", json={
        "first_name": "Maria", "last_name": "Cruz", "email": "maria@example.com",
        "phone_number": "09171234567", "address": "14 Rizal Street",
        "password": "Passw0rd!", "is_minor": False,
    })
    token = r.json()["id_token"]
    assert token

    from core.security import decode_id_submit_token, decode_access_token
    assert decode_id_submit_token(token) is not None, "it opens the ID upload"
    payload = decode_access_token(token)
    assert payload.get("type") == "id_submit", "and it is not a session"


@pytest.mark.parametrize("status", ["none", "pending", "rejected"])
def test_sign_in_waits_on_an_officer(client, make_user, status):
    make_user(id_status=status)
    r = client.post("/auth/login",
                    json={"email": "maria@example.com", "password": "Passw0rd!"})
    assert r.status_code == 403
    detail = r.json()["detail"]
    assert detail["code"] == "id_not_verified"
    assert detail["id_status"] == status
    assert detail["id_token"], \
        "without this a rejected ID strands the account: locked out, no way to send another"


def test_an_approved_account_signs_in(client, make_user):
    make_user(id_status="approved")
    r = client.post("/auth/login",
                    json={"email": "maria@example.com", "password": "Passw0rd!"})
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_a_refused_sign_in_does_not_count_toward_a_lockout(client, make_user):
    """The password was right. Waiting on the desk is not a failed attempt."""
    make_user(id_status="pending")
    for _ in range(8):
        r = client.post("/auth/login",
                        json={"email": "maria@example.com", "password": "Passw0rd!"})
        assert r.status_code == 403, "a lockout here would punish her for waiting"


def test_a_single_purpose_token_cannot_be_used_as_a_session(client, make_user):
    """Before this check, a verification link pasted into an Authorization
    header opened the whole account."""
    u = make_user(id_status="approved")
    from core.security import create_verify_token, create_id_submit_token

    for token in (create_verify_token(u.id), create_id_submit_token(u.id)):
        r = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401
