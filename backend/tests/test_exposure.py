"""What this server offers to someone who has not signed in.

Most of these are not holes. They are the shape of the surface, and the point of
writing them down is that the shape stops changing by accident.
"""
import os
import sys

import pytest
from fastapi.routing import APIRoute

import main

GUARDS = {
    "get_current_user",
    "get_current_admin",
    "get_current_admin_full_access",
    "require_super_admin",
    "get_user_for_id_submission",
}

# Everything reachable without any authentication at all. Each one has to be
# open for the system to work: you cannot require a session to create a session.
# Anything joining this list is a decision, which is why the list is written out
# rather than counted.
EXPECTED_PUBLIC = {
    ("GET", "/"),
    ("POST", "/admin/auth/login"),
    ("POST", "/admin/auth/logout"),
    ("POST", "/admin/auth/refresh"),
    ("GET", "/auth/channels"),
    ("POST", "/auth/forgot-password/request"),
    ("POST", "/auth/forgot-password/reset"),
    ("POST", "/auth/forgot-password/verify-otp"),
    ("POST", "/auth/login"),
    ("POST", "/auth/otp/send"),
    ("POST", "/auth/otp/send-email"),
    ("POST", "/auth/otp/verify"),
    ("POST", "/auth/read-id"),
    ("POST", "/auth/register"),
    ("GET", "/auth/verify-link"),
    ("GET", "/health/db"),
    ("GET", "/media/photo"),
    ("POST", "/users/recover"),
    # The emergency numbers, deliberately readable with no session. They are
    # the published contact details of public offices, so there is nothing
    # here to protect - and a woman with no account, not signed in, must be
    # able to reach them. A login between her and 911 is the failure this
    # endpoint exists to avoid. Writing them still needs an officer.
    ("GET", "/hotlines"),
    ("GET", "/hotlines/"),
}


def _dependency_names(dependant, acc=None):
    acc = acc if acc is not None else set()
    for sub in dependant.dependencies:
        call = getattr(sub, "call", None)
        if call is not None:
            acc.add(getattr(call, "__name__", type(call).__name__))
        _dependency_names(sub, acc)
    return acc


def _public_routes(app):
    out = set()
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if _dependency_names(route.dependant) & GUARDS:
            continue
        for method in route.methods - {"HEAD", "OPTIONS"}:
            out.add((method, route.path))
    return out


def test_nothing_new_is_open_to_the_public():
    """A new endpoint that forgets its guard shows up here as a failure."""
    assert _public_routes(main.app) == EXPECTED_PUBLIC


def test_almost_everything_else_needs_a_session():
    total = sum(1 for r in main.app.routes if isinstance(r, APIRoute))
    assert total - len(EXPECTED_PUBLIC) > 80


@pytest.fixture()
def client_quiet(db):
    """A client that lets the app handle its own errors.

    TestClient re-raises server exceptions by default, which is friendly while
    debugging and useless for checking what a real caller would actually see.
    """
    from fastapi.testclient import TestClient
    with TestClient(main.app, raise_server_exceptions=False) as c:
        yield c


def test_a_server_error_does_not_describe_itself(client_quiet, monkeypatch):
    """A stack trace tells an outsider the framework, the file layout and the
    line that broke."""
    from fastapi import HTTPException
    import routers.auth as ra

    def boom(*a, **k):
        raise RuntimeError("psycopg2 connection to 10.0.0.4 failed")

    monkeypatch.setattr(ra, "sms_enabled", boom)
    r = client_quiet.get("/auth/channels")
    assert r.status_code == 500
    body = r.text.lower()
    for leak in ("psycopg2", "traceback", "10.0.0.4", "runtimeerror", "file \""):
        assert leak not in body


def test_the_health_check_has_a_brake(client):
    """It is the one public route that reaches Postgres, and on a free Neon plan
    compute is the budget. A monitor polling it too often took this system down
    once already."""
    codes = [client.get("/health/db").status_code for _ in range(40)]
    assert codes[0] == 200
    assert 429 in codes


# ── The docs ────────────────────────────────────────────────────────────────
# Run in a subprocess rather than by reloading modules in place. Reloading
# swaps main and the routers for fresh objects while the shared fixtures still
# hold the old ones, and the rate limiters that come with them: the next test
# file then fails for a reason that has nothing to do with it. Took a while to
# work out, so it is written down here.

DOCS_PROBE = (
    "import json, main; "
    "print(json.dumps(sorted({getattr(r, 'path', None) for r in main.app.routes} "
    "& {'/docs', '/redoc', '/openapi.json', '/auth/channels'})))"
)


def _paths_with(**env):
    import json
    import subprocess

    child = dict(os.environ)
    child.pop("ALLOWED_ORIGINS", None)
    child.pop("ENABLE_DOCS", None)
    child.update(env)
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    out = subprocess.run([sys.executable, "-c", DOCS_PROBE],
                         cwd=here, env=child, capture_output=True, text=True, timeout=120)
    assert out.returncode == 0, out.stderr[-800:]
    return set(json.loads(out.stdout.strip().splitlines()[-1]))


def test_locally_the_docs_are_there_to_work_with():
    assert {"/docs", "/redoc", "/openapi.json"} <= _paths_with()


def test_deployed_they_are_not():
    """They hand anyone who asks a complete map: every endpoint, every field
    name, every shape of request that will be accepted."""
    paths = _paths_with(ALLOWED_ORIGINS="https://vawc-victim-2026.web.app")
    assert not ({"/docs", "/redoc", "/openapi.json"} & paths)
    assert "/auth/channels" in paths, "the api itself still works"


def test_they_can_be_turned_back_on_deliberately():
    paths = _paths_with(ALLOWED_ORIGINS="https://vawc-victim-2026.web.app",
                        ENABLE_DOCS="true")
    assert "/docs" in paths
