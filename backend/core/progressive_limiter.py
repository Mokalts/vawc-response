"""
Progressive Rate Limiter for VAWC-Response
==========================================
Lockout schedule per IP:
  5 failed attempts  →  locked 1 minute
  1 more attempt     →  locked 5 minutes
  1 more attempt     →  locked 15 minutes
  1 more attempt     →  locked 60 minutes  (cap — stays here forever until success)

On successful login → full reset.
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
LOCKOUT_SCHEDULE = [
    (5,  60),       # Stage 0 → 5 fails   = 1 min
    (1,  300),      # Stage 1 → 1 more    = 5 min
    (1,  900),      # Stage 2 → 1 more    = 15 min
    (1,  3600),     # Stage 3 → 1 more    = 60 min
    (1,  86400),    # Stage 4 → 1 more    = 24 hours (max)
]

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
    }


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

        # If a previous lockout just expired, reset stage attempts
        if 0 < rec["locked_until"] <= now:
            rec["stage_attempts"] = 0

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
