"""The editable hotline list.

The one rule worth more than the rest: the panel must never end up empty. A
woman who opens Hotlines and finds nothing has been told there is nobody to
call, which is worse than finding a number that has moved.
"""
import pytest

import main
from models.admin import Admin
from models.hotline import Hotline


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


def _seed(db, **over):
    data = dict(label="PNP Emergency", dial="911", display="911",
                description="Police response.", is_critical=True,
                is_test=False, is_active=True, sort_order=10)
    data.update(over)
    h = Hotline(**data)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


# ── The public list ─────────────────────────────────────────────────────────

def test_hotlines_are_readable_without_signing_in(client, db):
    """Requiring a session here would put a login between her and 911."""
    _seed(db)
    r = client.get("/hotlines")
    assert r.status_code == 200
    assert r.json()["hotlines"][0]["display"] == "911"


def test_the_critical_one_comes_first(client, db):
    _seed(db, label="DSWD", display="1343", is_critical=False, sort_order=5)
    _seed(db, label="PNP Emergency", display="911", is_critical=True, sort_order=90)

    first = client.get("/hotlines").json()["hotlines"][0]
    assert first["display"] == "911"


def test_an_inactive_hotline_is_hidden_from_the_app(client, db):
    _seed(db)
    _seed(db, label="Test Number", display="0908 526 7335", is_active=False, is_critical=False)

    labels = [h["label"] for h in client.get("/hotlines").json()["hotlines"]]
    assert "Test Number" not in labels


def test_an_undiallable_number_still_appears(client, db):
    """Published with letters, so it has no dial value and the app renders it
    as text rather than a call link that would do nothing."""
    _seed(db, label="PNP WCPD", dial=None, display="1800-188-PNP-107", is_critical=False)

    row = [h for h in client.get("/hotlines").json()["hotlines"] if h["label"] == "PNP WCPD"][0]
    assert row["dial"] is None
    assert row["display"] == "1800-188-PNP-107"


# ── Editing ─────────────────────────────────────────────────────────────────

def test_an_officer_can_add_one(client, db, as_officer_full):
    r = client.post("/admin/hotlines", json={
        "label": "Iba Municipal Police Station",
        "display": "(047) 811-7319",
        "dial": "+63478117319",
    })
    assert r.status_code == 201
    assert r.json()["label"] == "Iba Municipal Police Station"


def test_an_officer_can_correct_a_number(client, db, as_officer_full):
    h = _seed(db, label="PAO", display="(02) 8929-9436", dial="+63289299436")
    r = client.patch(f"/admin/hotlines/{h.id}",
                     json={"display": "(047) 611-1349", "dial": "+63476111349"})
    assert r.status_code == 200
    assert r.json()["display"] == "(047) 611-1349"


def test_an_officer_can_delete_one(client, db, as_officer_full):
    _seed(db)
    gone = _seed(db, label="Old line", display="123", is_critical=False)

    assert client.delete(f"/admin/hotlines/{gone.id}").status_code == 200
    labels = [h["label"] for h in client.get("/hotlines").json()["hotlines"]]
    assert "Old line" not in labels


def test_the_last_hotline_cannot_be_deleted(client, db, as_officer_full):
    """An empty panel tells her there is nobody to call."""
    only = _seed(db)
    r = client.delete(f"/admin/hotlines/{only.id}")
    assert r.status_code == 409
    assert client.get("/hotlines").json()["hotlines"]


def test_a_test_line_does_not_count_as_the_last_real_one(client, db, as_officer_full):
    """Otherwise a leftover test entry makes the panel look covered when the
    only real number has just been removed."""
    real = _seed(db)
    _seed(db, label="Test Number", display="0908 526 7335", is_test=True, is_critical=False)

    assert client.delete(f"/admin/hotlines/{real.id}").status_code == 409


def test_a_hotline_needs_a_name_and_a_number(client, db, as_officer_full):
    assert client.post("/admin/hotlines", json={"label": "  ", "display": "911"}).status_code == 422
    assert client.post("/admin/hotlines", json={"label": "PNP", "display": " "}).status_code == 422


def test_the_admin_list_includes_inactive_ones(client, db, as_officer_full):
    _seed(db)
    _seed(db, label="Paused", display="000", is_active=False, is_critical=False)

    labels = [h["label"] for h in client.get("/admin/hotlines").json()["hotlines"]]
    assert "Paused" in labels


def test_editing_a_missing_hotline_is_a_404(client, db, as_officer_full):
    assert client.patch("/admin/hotlines/9999", json={"label": "x"}).status_code == 404
    assert client.delete("/admin/hotlines/9999").status_code == 404
