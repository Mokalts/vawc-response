"""One time frame for everything stored.

Every timestamp the system generates uses `datetime.utcnow()`, so it is UTC. Two
do not: the incident date the victim picks, and the date a BPO was served, which
an officer types. Those arrive from a browser's local picker with no timezone on
them, so they were stored as Manila wall-clock time while everything beside them
was UTC. Two frames in one column set is how a case ends up filed on the wrong
day and counted in the wrong month.

They are converted on the way in, so the database holds UTC and only UTC, and a
client can treat every timestamp the API returns the same way.

The Philippines is UTC+8 and has observed no daylight saving since 1978, so a
fixed offset is correct here and avoids a timezone database dependency. If this
system is ever deployed outside PST, this is the assumption to revisit.
"""
from datetime import datetime, timedelta, timezone

PH_OFFSET = timedelta(hours=8)
PH_TZ = timezone(PH_OFFSET, name="PST")


def ph_local_to_utc(dt: datetime):
    """Read a naive datetime as Manila wall-clock and return naive UTC.

    An aware datetime is converted from whatever zone it carries, so a client
    that does send an offset is believed rather than second-guessed.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=PH_TZ)
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def utc_to_ph_local(dt: datetime):
    """The other direction, for anything that has to render a local time
    server-side, such as a printed form."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(PH_TZ).replace(tzinfo=None)
