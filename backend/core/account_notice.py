"""Telling someone their account changed.

The panel asked for this at the pre-final defense, and the reason it matters
here is sharper than for most apps: if an abuser gets into her account, the
first thing he does is change the phone number or the password, and a silent
change is how that goes unnoticed until she can no longer sign in.

Three rules, all deliberate:

  * It names WHAT changed, never the new value. An email quoting a new phone
    number or address hands that detail to anyone who can read her inbox, and
    for this app that may be the person she is reporting.
  * It never raises. A notice that fails must not undo the change the person
    just made, or take the request down with it.
  * It sends in the background, so a slow mail server does not make saving a
    profile feel broken.
"""
import threading
from datetime import datetime

from core.timeutil import utc_to_ph_local
from utils.email_templates import account_changed_email
from utils.otp_helper import send_html_email


def _deliver(to_email: str, name: str, changes, when: str, by_officer: bool):
    try:
        subject, body = account_changed_email(name, changes, when, by_officer)
        send_html_email(to_email, subject, body)
        print(f"[ACCOUNT] change notice sent to {to_email}: {', '.join(changes)}")
    except Exception as e:  # noqa: BLE001
        print(f"[ACCOUNT] could not notify {to_email}: {e}")


def notify_account_change(user, changes, by_officer: bool = False, also_email: str = None):
    """Tell the account holder what changed. Never raises.

    `also_email` is for an email-address change: the old address has to be told
    too, or the one person who needs the warning is the one who stops receiving
    it.
    """
    if not changes:
        return

    name = " ".join(filter(None, [getattr(user, "first_name", ""), getattr(user, "last_name", "")])).strip() or "there"
    when = utc_to_ph_local(datetime.utcnow()).strftime("%B %d, %Y at %I:%M %p")

    targets = {e for e in (getattr(user, "email", None), also_email) if e}
    for to_email in targets:
        threading.Thread(
            target=_deliver,
            args=(to_email, name, list(changes), when, by_officer),
            daemon=True,
        ).start()
