"""
One layout for every email VAWC-Response sends.

The three emails (verification code, case status update, case message) used to
be written separately and had drifted apart: they carried a maroon and pink
palette from before the portals were unified on orange, different headers, and
different footers. A victim who gets all three should see one sender, not three.

Email HTML is not web HTML: use tables for layout, inline styles only, and no
flex, grid, or external CSS. Many clients strip <style> blocks entirely, so
every rule here sits on the element it affects.
"""

# Brand tokens, matching the portals (see victim-frontend/src/index.css).
ORANGE      = "#C45E10"   # headers, buttons: dark enough for white text
ORANGE_LITE = "#F47920"
INK         = "#1F1A17"
BODY        = "#4A4340"
MUTED       = "#8A817C"
PAPER       = "#FBF6F1"
CARD        = "#FFFFFF"
BORDER      = "#EADFD5"
TINT        = "#FDF3EA"

FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"

ORG  = "Barangay Palanginan, Iba, Zambales"


def _shell(preheader: str, inner: str) -> str:
    """Wrap content in the shared frame: wordmark, card, footer."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:{PAPER};font-family:{FONT};">
<!-- Preview text: shown in the inbox list, hidden in the message itself. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{PAPER};padding:28px 14px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

  <tr><td style="padding:0 0 18px 4px;">
    <span style="font-size:17px;font-weight:700;color:{ORANGE};letter-spacing:-0.2px;">VAWC-Response</span>
  </td></tr>

  <tr><td style="background:{CARD};border:1px solid {BORDER};border-radius:14px;overflow:hidden;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="height:4px;background:{ORANGE};font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:28px 28px 26px;">
{inner}
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:18px 4px 0;">
    <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:{MUTED};">
      This message is confidential. Do not forward it to anyone.
    </p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:{MUTED};">
      VAWC-Response &middot; {ORG}<br>
      Protected under Republic Act 9262. This mailbox is not monitored.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""


def _heading(title: str, intro: str) -> str:
    return f"""        <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:{INK};letter-spacing:-0.3px;">{title}</p>
        <p style="margin:0 0 22px;font-size:13px;color:{MUTED};">{ORG}</p>
        <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:{BODY};">{intro}</p>"""


def _panel(rows) -> str:
    """A bordered block of label/value pairs, e.g. case number and status."""
    cells = []
    for i, (label, value) in enumerate(rows):
        top = "" if i == 0 else "padding-top:14px;"
        cells.append(f"""          <tr><td style="{top}">
            <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:{MUTED};">{label}</p>
            <p style="margin:0;font-size:15px;font-weight:600;line-height:1.5;color:{INK};">{value}</p>
          </td></tr>""")
    return f"""        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{TINT};border:1px solid {BORDER};border-left:3px solid {ORANGE_LITE};border-radius:10px;margin:0 0 22px;">
          <tr><td style="padding:16px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
{chr(10).join(cells)}
        </table>
          </td></tr>
        </table>"""


def _button(href: str, label: str) -> str:
    return f"""        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;">
          <tr><td style="background:{ORANGE};border-radius:10px;">
            <a href="{href}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">{label}</a>
          </td></tr>
        </table>"""


def _note(text: str) -> str:
    return f"""        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{TINT};border:1px solid {BORDER};border-radius:10px;margin:22px 0 0;">
          <tr><td style="padding:13px 16px;">
            <p style="margin:0;font-size:13px;line-height:1.6;color:{BODY};">{text}</p>
          </td></tr>
        </table>"""


# ── The three emails ─────────────────────────────────────────────────────────

def otp_email(code: str, verify_link: str = None, expire_minutes: int = 5):
    """Verification code, and optionally a one-tap verify button."""
    # One selectable run of text, NOT one box per digit. The old version split
    # the code across six table cells, so selecting it copied padding and line
    # breaks instead of the number.
    code_block = f"""        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
          <tr><td align="center" style="background:{TINT};border:1px solid {BORDER};border-radius:12px;padding:20px 12px;">
            <span style="font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:{ORANGE};">{code}</span>
          </td></tr>
        </table>
        <p style="margin:0 0 22px;text-align:center;font-size:12.5px;color:{MUTED};">Tap and hold the code to copy it</p>"""

    link_block = ""
    if verify_link:
        link_block = f"""        <div style="height:1px;background:{BORDER};margin:0 0 22px;font-size:0;line-height:0;">&nbsp;</div>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:{BODY};">
          Or verify in one tap, in case you closed the verification screen:
        </p>
{_button(verify_link, "Verify my account")}
        <p style="margin:0;font-size:12.5px;color:{MUTED};">This link expires in 24 hours.</p>"""

    inner = (
        _heading(
            "Verify your account",
            f"Use the code below to finish setting up your account. "
            f"It expires in <strong style=\"color:{INK};\">{expire_minutes} minutes</strong>.",
        )
        + code_block
        + link_block
        + _note("<strong>Did not request this?</strong> You can ignore this email. Your account will not be affected, and nobody is told that you received it.")
    )
    return "Your VAWC-Response verification code", _shell(
        f"Your verification code is {code}. It expires in {expire_minutes} minutes.", inner
    )


def case_status_email(victim_name: str, case_number: str, status_display: str, detail: str):
    """Sent when barangay staff move a case to a new status."""
    inner = (
        _heading(
            f"Hello, {victim_name}",
            "There is an update on the case you reported to the barangay.",
        )
        + _panel([("Case number", case_number), ("New status", status_display)])
        + f"""        <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:{BODY};">{detail}</p>
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:{MUTED};">Sign in to the VAWC-Response app to see the full details of your case.</p>"""
    )
    return (
        f"Case {case_number}: {status_display}",
        _shell(f"Your case {case_number} is now {status_display}.", inner),
    )


def case_message_email(victim_name: str, case_number: str, message: str):
    """Sent when staff write a message to the person who reported."""
    inner = (
        _heading(
            f"Hello, {victim_name}",
            "The barangay VAWC desk sent you a message about your case.",
        )
        + _panel([("Case number", case_number), ("Message", message)])
        + f"""        <p style="margin:0;font-size:13.5px;line-height:1.6;color:{MUTED};">Sign in to the VAWC-Response app to read your case and reply.</p>"""
    )
    return (
        f"New message on case {case_number}",
        _shell(f"The barangay VAWC desk sent you a message about case {case_number}.", inner),
    )
