"""
Progressive Rate Limiter for VAWC-Response
==========================================
Lockout schedule per account:
  5 failed attempts  →  locked 1 minute
  3 more attempts    →  locked 5 minutes
  3 more attempts    →  locked 15 minutes
  3 more attempts    →  locked 60 minutes
  3 more attempts    →  locked 24 hours   (cap)

On successful login → full reset.
Quiet for DECAY_SECONDS → full reset, so an old lockout cannot ambush someone
who comes back days later and mistypes once.
"""

import time
from threading import Lock
from typing import Dict

# In-memory store — keyed by a string like "admin_login:192.168.1.1"
_store: Dict[str, dict] = {}
_lock = Lock()

# (attempts_needed_to_trigger, lockout_seconds)
# Per-ACCOUNT schedule: escalates hard, because repeated failures against one
# account is what credential guessing looks like.
#
# Later stages need 3 failures, not 1. With a threshold of 1 the ladder made a
# SINGLE typo enough to trigger a 5, 15 or 60 minute lockout for anyone who had
# ever tripped the first stage — which is what a victim hits when she comes back
# to the app days later and misremembers her password once.
LOCKOUT_SCHEDULE = [
    (5,  60),       # Stage 0 → 5 fails   = 1 min
    (3,  300),      # Stage 1 → 3 more    = 5 min
    (3,  900),      # Stage 2 → 3 more    = 15 min
    (3,  3600),     # Stage 3 → 3 more    = 60 min
    (3,  86400),    # Stage 4 → 3 more    = 24 hours (max)
]

# How long a quiet period wipes the slate clean. Without this the stage only
# ever went up: it was cleared by a successful login and by nothing else, so a
# lockout from last week still applied today. Guessing a password needs many
# attempts in quick succession, and those are still caught; someone who mistypes
# twice, walks away, and returns after half an hour starts fresh.
DECAY_SECONDS = 1800  # 30 minutes

# Per-NETWORK schedule: flat and forgiving, and it deliberately does NOT
# escalate. Many people share one public IP (a barangay hall, a venue's wifi,
# anything behind NAT), and a reverse proxy can make every request appear to
# come from a single address. An escalating IP lockout in that situation locks
# out an entire room, or everyone, because of one person's typos. This exists
# only to slow bulk credential stuffing; the per-account schedule above is the
# real protection.
IP_LOCKOUT_SCHEDULE = [
    (30, 120),      # 30 failures from one address = 2 min, then repeats
]
MAX_LOCKOUT = 86400  # 24 hours cap


def _fresh_record() -> dict:
    return {
        "stage":          0,   # which lockout stage we're on
        "stage_attempts": 0,   # attempts since last lockout expired
        "locked_until":   0.0, # unix timestamp
        "last_failure":   0.0, # unix timestamp of the most recent failure
    }


def _decayed(rec: dict, now: float) -> bool:
    """True when this record is stale enough to discard.

    A record is kept while a lockout is still running, so waiting out a lockout
    never clears the escalation that produced it.
    """
    if rec["locked_until"] > now:
        return False
    return bool(rec["last_failure"]) and (now - rec["last_failure"]) > DECAY_SECONDS


def check_rate_limit(key: str) -> dict:
    """
    Call at the START of every login attempt.
    Returns:
        {"allowed": True}
        {"allowed": False, "retry_after": <seconds>, "message": <str>}
    """
    now = time.time()
    with _lock:
        rec = _store.get(key, _fresh_record())

        if _decayed(rec, now):
            _store.pop(key, None)
            return {"allowed": True}

        if rec["locked_until"] > now:
            remaining = int(rec["locked_until"] - now) + 1  # round up
            minutes, seconds = divmod(remaining, 60)
            if minutes:
                time_str = f"{minutes} minute{'s' if minutes > 1 else ''} and {seconds} second{'s' if seconds != 1 else ''}"
            else:
                time_str = f"{seconds} second{'s' if seconds != 1 else ''}"
            return {
                "allowed": False,
                "retry_after": remaining,
                "message": f"Too many failed login attempts. Please try again in {time_str}.",
            }

        return {"allowed": True}


def record_failure(key: str, schedule=None):
    """Call after a FAILED login attempt (wrong credentials).

    `schedule` defaults to the escalating per-account ladder; pass
    IP_LOCKOUT_SCHEDULE for the flat per-network guard.
    """
    schedule = schedule or LOCKOUT_SCHEDULE
    now = time.time()
    with _lock:
        rec = _store.get(key, _fresh_record())

        # Long enough since the last failure: treat this as a first mistake
        # again, rather than the next rung of an old ladder.
        if _decayed(rec, now):
            rec = _fresh_record()

        # If a previous lockout has expired, start this stage's count fresh and
        # CLEAR the timestamp. Leaving it set re-ran this branch on every later
        # failure, so the count could never climb past 1 and the next lockout
        # never arrived.
        if 0 < rec["locked_until"] <= now:
            rec["stage_attempts"] = 0
            rec["locked_until"] = 0.0

        rec["last_failure"] = now
        rec["stage_attempts"] += 1
        stage = rec["stage"]

        if stage < len(schedule):
            threshold, duration = schedule[stage]
        else:
            # Past the end of the ladder: repeat its last step forever. For the
            # account ladder that is 24h; for the flat IP guard it stays 2 min,
            # so a shared address can never cascade into a long lockout.
            threshold, duration = schedule[-1]

        if rec["stage_attempts"] >= threshold:
            rec["locked_until"] = now + duration
            rec["stage"] = min(stage + 1, len(schedule))
            rec["stage_attempts"] = 0

        _store[key] = rec


def record_success(key: str):
    """Call after a SUCCESSFUL login — fully resets the counter."""
    with _lock:
        _store.pop(key, None)


def client_ip(request) -> str:
    """Best-effort client address.

    Behind Render's proxy, request.client.host is the proxy, which is the same
    value for every user on the internet. X-Forwarded-For's leftmost entry is
    the original client. A client can forge that header, so this is NOT a
    security boundary on its own — it only spreads the coarse network guard
    across real users instead of collapsing everyone into one bucket. The
    per-account key is what actually stops guessing.
    """
    xff = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if xff:
        return xff
    return getattr(getattr(request, "client", None), "host", "") or "unknown"


def login_keys(scope: str, request, identifier: str):
    """Return (account_key, ip_key) for a login attempt.

    The account key is per (network, account) so one person's typos can never
    lock out anyone else sharing the venue's wifi. The ip key is the flat
    bulk-abuse guard.
    """
    ip = client_ip(request)
    ident = (identifier or "").strip().lower()
    return f"{scope}:{ip}:{ident}", f"{scope}_ip:{ip}"
