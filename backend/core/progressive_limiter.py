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
LOCKOUT_SCHEDULE = [
    (5,  60),       # Stage 0 → 5 fails   = 1 min
    (1,  300),      # Stage 1 → 1 more    = 5 min
    (1,  900),      # Stage 2 → 1 more    = 15 min
    (1,  3600),     # Stage 3 → 1 more    = 60 min
    (1,  86400),    # Stage 4 → 1 more    = 24 hours (max)
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


def record_failure(key: str):
    """Call after a FAILED login attempt (wrong credentials)."""
    now = time.time()
    with _lock:
        rec = _store.get(key, _fresh_record())

        # If a previous lockout just expired, reset stage attempts
        if 0 < rec["locked_until"] <= now:
            rec["stage_attempts"] = 0

        rec["stage_attempts"] += 1
        stage = rec["stage"]

        if stage < len(LOCKOUT_SCHEDULE):
            threshold, duration = LOCKOUT_SCHEDULE[stage]
        else:
            # Already at max stage — every attempt re-locks for 24 hours
            threshold, duration = 1, 86400

        if rec["stage_attempts"] >= threshold:
            rec["locked_until"] = now + duration
            rec["stage"] = min(stage + 1, len(LOCKOUT_SCHEDULE))
            rec["stage_attempts"] = 0

        _store[key] = rec


def record_success(key: str):
    """Call after a SUCCESSFUL login — fully resets the counter."""
    with _lock:
        _store.pop(key, None)
