"""Case Records pagination.

A cap is not pagination: the list used to stop at 500 with nothing on screen
saying anything had been left out.
"""
from datetime import date

import pytest

import main
from models.admin import Admin
from models.case import Case
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


def _people_with_cases(db, how_many, cases_each=1):
    made = []
    for i in range(how_many):
        u = User(first_name="Maria", last_name="Cruz%03d" % i,
                 email="m%03d@example.com" % i, phone_number="0917%07d" % i,
                 address="14 Rizal Street", birthdate=date(1995, 3, 15),
                 password_hash=hash_password("Passw0rd!"), is_verified=True,
                 id_status="approved")
        db.add(u)
        db.commit()
        db.refresh(u)
        for c in range(cases_each):
            db.add(Case(case_number="2026-%03d-%03d" % (i, c), user_id=u.id,
                        offender_name="x", status=ReportStatus.under_assessment))
        db.commit()
        made.append(u)
    return made


# ── The people list ─────────────────────────────────────────────────────────

def test_it_returns_one_page_and_says_how_many_there_are(client, db, as_officer_full):
    _people_with_cases(db, 7)
    body = client.get("/admin/cases/victims?page=1&page_size=3").json()

    assert len(body["items"]) == 3
    assert body["total"] == 7
    assert body["pages"] == 3
    assert body["page"] == 1


def test_the_last_page_holds_the_remainder(client, db, as_officer_full):
    _people_with_cases(db, 7)
    body = client.get("/admin/cases/victims?page=3&page_size=3").json()
    assert len(body["items"]) == 1
    assert body["page"] == 3


def test_pages_do_not_repeat_or_skip_anyone(client, db, as_officer_full):
    _people_with_cases(db, 7)
    seen = []
    for page in (1, 2, 3):
        body = client.get(f"/admin/cases/victims?page={page}&page_size=3").json()
        seen += [item["user_id"] for item in body["items"]]

    assert len(seen) == 7
    assert len(set(seen)) == 7, "somebody appeared on two pages"


def test_a_page_past_the_end_is_empty_rather_than_an_error(client, db, as_officer_full):
    _people_with_cases(db, 2)
    body = client.get("/admin/cases/victims?page=9&page_size=10").json()
    assert body["items"] == []
    assert body["total"] == 2


def test_the_search_is_counted_too(client, db, as_officer_full):
    """Otherwise the pager reports the size of the unfiltered list and offers
    pages that are empty."""
    _people_with_cases(db, 5)
    body = client.get("/admin/cases/victims?search=Cruz001&page_size=100").json()
    assert body["total"] == len(body["items"]) == 1


def test_the_default_page_is_a_hundred(client, db, as_officer_full):
    _people_with_cases(db, 3)
    assert client.get("/admin/cases/victims").json()["page_size"] == 100


# ── The cases under one person ──────────────────────────────────────────────

def test_a_persons_cases_are_paged_twenty_at_a_time(client, db, as_officer_full):
    person = _people_with_cases(db, 1, cases_each=25)[0]
    body = client.get(f"/admin/cases/victims/{person.id}").json()

    assert body["page_size"] == 20
    assert len(body["cases"]) == 20
    assert body["total"] == 25
    assert body["pages"] == 2

    second = client.get(f"/admin/cases/victims/{person.id}?page=2").json()
    assert len(second["cases"]) == 5

    first_ids = {c["id"] for c in body["cases"]}
    second_ids = {c["id"] for c in second["cases"]}
    assert not (first_ids & second_ids), "a case appeared on both pages"


def test_the_person_is_still_returned_with_their_cases(client, db, as_officer_full):
    """The page draws their name from this, so paging must not drop it."""
    person = _people_with_cases(db, 1, cases_each=3)[0]
    body = client.get(f"/admin/cases/victims/{person.id}").json()
    assert body["victim"]["id"] == person.id
    assert body["victim"]["full_name"]


def test_an_oversized_page_is_refused(client, db, as_officer_full):
    """So a caller cannot ask for everything and undo the point of paging."""
    _people_with_cases(db, 1)
    assert client.get("/admin/cases/victims?page_size=5000").status_code == 422
    assert client.get("/admin/cases/victims?page=0").status_code == 422


# ── Sorting, which has to happen before the slice ───────────────────────────

def _person(db, surname, cases, latest):
    u = User(first_name="Ana", last_name=surname, email=f"{surname}@example.com",
             phone_number="0917" + surname[-7:].rjust(7, "0"),
             address="14 Rizal Street", birthdate=date(1995, 3, 15),
             password_hash=hash_password("Passw0rd!"), is_verified=True,
             id_status="approved")
    db.add(u)
    db.commit()
    db.refresh(u)
    for n in range(cases):
        db.add(Case(case_number=f"2026-{surname}-{n:03d}", user_id=u.id,
                    offender_name="x", status=ReportStatus.under_assessment,
                    updated_at=latest))
    db.commit()
    return u


def test_recent_activity_is_ordered_before_the_page_is_cut(client, db, as_officer_full):
    """The browser used to sort the rows it had been given, so "most recent"
    meant the most recent of whichever page the server happened to pick."""
    from datetime import datetime
    oldest = _person(db, "Aquino", 1, datetime(2026, 1, 5))
    newest = _person(db, "Zamora", 1, datetime(2026, 9, 9))

    first = client.get("/admin/cases/victims?sort=recent&page=1&page_size=1").json()
    assert [i["user_id"] for i in first["items"]] == [newest.id]

    second = client.get("/admin/cases/victims?sort=recent&page=2&page_size=1").json()
    assert [i["user_id"] for i in second["items"]] == [oldest.id]

    flipped = client.get("/admin/cases/victims?sort=oldest&page=1&page_size=1").json()
    assert [i["user_id"] for i in flipped["items"]] == [oldest.id]


def test_most_cases_comes_first_across_the_whole_list(client, db, as_officer_full):
    from datetime import datetime
    _person(db, "Abad", 1, datetime(2026, 2, 2))
    busiest = _person(db, "Yabut", 4, datetime(2026, 2, 2))

    body = client.get("/admin/cases/victims?sort=cases&page_size=1").json()
    assert body["items"][0]["user_id"] == busiest.id
    assert body["items"][0]["case_count"] == 4


def test_name_order_is_by_surname(client, db, as_officer_full):
    from datetime import datetime
    _person(db, "Zamora", 1, datetime(2026, 9, 9))
    first_alphabetically = _person(db, "Abad", 1, datetime(2026, 2, 2))

    body = client.get("/admin/cases/victims?sort=name&page_size=1").json()
    assert body["items"][0]["user_id"] == first_alphabetically.id


def test_an_unknown_sort_is_refused(client, db, as_officer_full):
    """Rather than silently falling back to an order the officer did not ask
    for."""
    _people_with_cases(db, 1)
    assert client.get("/admin/cases/victims?sort=whatever").status_code == 422


def test_nobody_is_listed_twice_when_they_have_several_cases(client, db, as_officer_full):
    """The old query joined to Case and leaned on DISTINCT for this."""
    _people_with_cases(db, 1, cases_each=5)
    body = client.get("/admin/cases/victims").json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["case_count"] == 5
