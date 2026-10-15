"""Shared setup for the test suite.

Everything runs against a throwaway SQLite file, never a real database. The
environment is set before anything imports core.config, because that reads it
once at import time and a test that quietly pointed at Neon would be a very bad
test to have written.

Foreign keys are switched on. SQLite ignores them unless asked, and one of the
bugs these tests exist to catch was a foreign key violation that only appeared
on Postgres.
"""
import os
import sys
from datetime import date, datetime

TEST_DB = "sqlite:///./_pytest.db"

os.environ["DATABASE_URL"] = TEST_DB
os.environ["SECRET_KEY"] = "t" * 40
os.environ["ENCRYPTION_KEY"] = "xZ1Qp8rT3vY6wA9cE2hJ5kN7mR0sU4bD8fG1iL3oP5Q="
for _k in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"):
    os.environ[_k] = "dummy"
os.environ.pop("ALLOWED_ORIGINS", None)
os.environ.pop("ENABLE_DOCS", None)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy import event
from sqlalchemy.engine import Engine


@event.listens_for(Engine, "connect")
def _enforce_foreign_keys(dbapi_conn, _record):
    try:
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()
    except Exception:
        pass


import main  # noqa: E402  (imports every model and router)
from database import Base, engine, SessionLocal  # noqa: E402
from models.user import User  # noqa: E402
from models.admin import Admin  # noqa: E402
from core.security import hash_password  # noqa: E402


@pytest.fixture()
def db():
    """A fresh schema per test. Cheap, and no test can leak into another."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    from fastapi.testclient import TestClient
    with TestClient(main.app) as c:
        yield c


@pytest.fixture()
def officer(db):
    a = Admin(first_name="Ana", last_name="Reyes", email="ana@example.com",
              phone_number="09181112222", employee_id="E1", username="officer1",
              position="VAWC Officer", is_super_admin=True,
              password_hash=hash_password("Adm1nPass!"), is_active=True,
              is_face_enrolled=True)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@pytest.fixture()
def as_officer(officer):
    """Admin routes without a face check, which cannot be done headlessly."""
    from core.admin_dependencies import get_current_admin_full_access
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


@pytest.fixture()
def make_user(db):
    """A verified, ID-approved account. Phones are unique; the column requires it."""
    def _make(email="maria@example.com", **kw):
        seq = db.query(User).count() + 1
        fields = dict(
            first_name="Maria", middle_name="Santos", last_name="Cruz",
            email=email, phone_number="0917000%04d" % seq,
            address="14 Rizal Street", birthdate=date(1995, 3, 15), sex="Female",
            password_hash=hash_password("Passw0rd!"), is_verified=True,
            id_status="approved", id_type="National ID",
        )
        fields.update(kw)
        u = User(**fields)
        db.add(u)
        db.commit()
        db.refresh(u)
        return u
    return _make


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """Rate limiters keep state across tests in one process, so a later test
    would fail for a reason that has nothing to do with it."""
    try:
        from core import progressive_limiter as pl
        pl._store.clear()
    except Exception:
        pass
    # slowapi counters outlive a test, so a later test would get a 429 for a
    # reason that has nothing to do with it.
    #
    # Two things make this fiddlier than it looks. There is not one limiter:
    # main, routers.auth and routers.admin_auth each construct their own, with
    # their own storage, and clearing one leaves the others counting. And
    # neither limiter.reset() nor storage.reset() empties a MemoryStorage;
    # reset() prunes expired entries and returns 0. The dicts underneath are
    # what hold the counts.
    from slowapi import Limiter
    seen = set()
    for module in list(sys.modules.values()):
        for name in dir(module) if module else ():
            if name.startswith("__"):
                continue
            try:
                value = getattr(module, name)
            except Exception:
                continue
            if not isinstance(value, Limiter) or id(value) in seen:
                continue
            seen.add(id(value))
            store = getattr(value, "_storage", None)
            for attr in ("storage", "events", "expirations"):
                holder = getattr(store, attr, None)
                if hasattr(holder, "clear"):
                    holder.clear()
    yield


def pytest_sessionfinish(session, exitstatus):
    for suffix in ("", "-journal"):
        path = "./_pytest.db" + suffix
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass
