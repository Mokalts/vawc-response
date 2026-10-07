"""Reading what it can off a photograph of an ID.

Used only to PREFILL the registration form. Everything it returns is a
suggestion she edits before submitting, and nothing is saved from it directly.
That is not a hedge, it is the design: "any ID" means no common layout. A PhilSys
card and a driver's licence are standardised; a barangay ID is whatever that
barangay printed. Add a phone photograph at an angle with glare and partial
results are the normal case, not the failure case.

The cost of getting it wrong is concrete. If a misread surname is accepted
without her noticing, that surname ends up on a Barangay Protection Order. So
this guesses, she corrects, and the form is never submitted on its own.

Needs OCR_API_KEY (a free key from ocr.space). Without one, scanning still
uploads the ID for the barangay to check; it simply suggests nothing, which is
why every caller must cope with empty suggestions.
"""
import re

import requests

from core.config import settings

OCR_URL = "https://api.ocr.space/parse/image"

# Lines that are the card's own furniture rather than anything about her.
NOISE = (
    "republic", "philippines", "republika", "pilipinas", "barangay", "city",
    "municipality", "province", "identification", "card", "id no", "signature",
    "valid", "until", "issued", "date of issue", "bearer", "holder", "office",
    "government", "national", "driver", "license", "licence", "philsys",
    "postal", "voter", "sss", "gsis", "philhealth", "tin", "umid", "passport",
)

MONTHS = ["january", "february", "march", "april", "may", "june", "july",
          "august", "september", "october", "november", "december"]

BIRTH_LABELS = ("birth", "kapanganakan", "dob", "born")

_NUMERIC = re.compile(r"\b(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})\b")
_WORDED = re.compile(
    r"\b(" + "|".join(MONTHS) + r")\s+(\d{1,2}),?\s+((?:19|20)\d{2})\b",
    re.IGNORECASE,
)


def _as_iso(y, m, d):
    try:
        y, m, d = int(y), int(m), int(d)
    except (TypeError, ValueError):
        return None
    if not (1900 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 31):
        return None
    return "%04d-%02d-%02d" % (y, m, d)


def _dates_in(text):
    """Every date in the text, as (position, iso).

    Numeric dates are ambiguous: 03/15/1995 is month-first, 15/03/1995 is
    day-first, and 03/04/1995 could be either. Where one component is above 12
    that settles it; where neither is, month-first is assumed, which is the
    commoner printing on Philippine IDs. A wrong guess between those two still
    gives her the right year and a date she can see is wrong.
    """
    out = []
    for m in _NUMERIC.finditer(text):
        a, b, c = m.group(1), m.group(2), m.group(3)
        iso = None
        if len(a) == 4:                       # 1995-03-15
            iso = _as_iso(a, b, c)
        elif len(c) == 4:
            if int(a) > 12:                   # 15/03/1995, day first
                iso = _as_iso(c, b, a)
            else:                             # 03/15/1995, month first
                iso = _as_iso(c, a, b)
        if iso:
            out.append((m.start(), iso))
    for m in _WORDED.finditer(text):
        iso = _as_iso(m.group(3), MONTHS.index(m.group(1).lower()) + 1, m.group(2))
        if iso:
            out.append((m.start(), iso))
    return sorted(out)


def _iso(text: str):
    """Her birthdate, if the text gives one away.

    An ID carries several dates: issue, expiry, birth. A date sitting just after
    a birth label is taken first, because that is the only reliable signal.
    Failing that the EARLIEST is used, since a birthdate is almost always older
    than the issue or expiry printed on the same card. This was wrong before: it
    took the earliest unconditionally and returned an issue date off a card that
    labelled its birthdate plainly.
    """
    dates = _dates_in(text)
    if not dates:
        return None

    low = text.lower()
    for label in BIRTH_LABELS:
        at = low.find(label)
        while at != -1:
            after = [iso for pos, iso in dates if pos >= at]
            if after:
                return after[0]
            at = low.find(label, at + 1)

    return min(iso for _, iso in dates)


def _name_lines(lines):
    """Lines that look like a person's name rather than the card's printing."""
    out = []
    for line in lines:
        clean = line.strip()
        low = clean.lower()
        if len(clean) < 4 or len(clean) > 48:
            continue
        if any(word in low for word in NOISE):
            continue
        if any(ch.isdigit() for ch in clean):
            continue
        letters = [c for c in clean if c.isalpha()]
        if not letters:
            continue
        # Names on Philippine IDs are printed in capitals far more often than
        # not, and that is the one signal that survives a bad photograph.
        if sum(1 for c in letters if c.isupper()) / len(letters) > 0.8:
            out.append(clean)
    return out


def _labelled(lines, labels):
    """The text beside, or on the line after, a label like "Address"."""
    for i, line in enumerate(lines):
        low = line.lower()
        for label in labels:
            if label in low:
                after = line.split(":", 1)[1].strip() if ":" in line else ""
                if len(after) > 3:
                    return after
                if i + 1 < len(lines) and len(lines[i + 1].strip()) > 3:
                    return lines[i + 1].strip()
    return None


def _looks_like_words(value: str) -> bool:
    """Is this real text, or what OCR produces from a photograph it cannot read?

    A blurred or skewed ID does not fail cleanly; it returns confident-looking
    rubbish such as "CRR TC TCnI elO aET". Putting that in her address field is
    worse than filling nothing, because she has to notice it and clear it, and
    an address she does not notice is one that ends up on a printed form.

    Real text has words with vowels and a few of reasonable length. Rubbish is
    mostly short fragments with odd capitals in the middle.
    """
    words = [w for w in re.split(r"[\s,]+", value or "") if w]
    if len(words) < 2:
        return False

    solid = [w for w in words if len(w) >= 3]
    if len(solid) < 2:
        return False

    alpha = [w for w in solid if any(c.isalpha() for c in w)]
    if alpha and not any(any(c in "aeiouAEIOU" for c in w) for w in alpha):
        return False

    # A capital inside a word, as in "TCnI", is a tell: real printing does not
    # do it, and OCR does it constantly when it is guessing.
    odd = sum(1 for w in words if len(w) > 2 and any(c.isupper() for c in w[1:]) and any(c.islower() for c in w))
    return odd <= len(words) / 3


def read_id(file_bytes: bytes, filename: str = "id.jpg"):
    """Return {suggestions, text_found}. Never raises.

    A failure here must not stop her registering: scanning is a convenience
    wrapped around a form she can fill in herself.
    """
    key = (getattr(settings, "OCR_API_KEY", "") or "").strip()
    if not key:
        return {"suggestions": {}, "text_found": False, "reason": "no_key"}

    try:
        resp = requests.post(
            OCR_URL,
            files={"file": (filename, file_bytes)},
            data={"apikey": key, "language": "eng", "OCREngine": "2",
                  "scale": "true", "isTable": "false"},
            timeout=25,
        )
        if resp.status_code != 200:
            print(f"[OCR] {resp.status_code}: {resp.text[:200]}")
            return {"suggestions": {}, "text_found": False, "reason": "service_error"}
        data = resp.json()
    except Exception as e:  # noqa: BLE001
        print(f"[OCR] failed: {e}")
        return {"suggestions": {}, "text_found": False, "reason": "service_error"}

    if data.get("IsErroredOnProcessing"):
        print(f"[OCR] rejected the image: {str(data.get('ErrorMessage'))[:200]}")
        return {"suggestions": {}, "text_found": False, "reason": "unreadable"}

    results = data.get("ParsedResults") or []
    text = (results[0].get("ParsedText") if results else "") or ""
    if not text.strip():
        return {"suggestions": {}, "text_found": False, "reason": "unreadable"}

    lines = [l for l in (ln.strip() for ln in text.splitlines()) if l]
    suggestions = {}

    birthdate = _iso(text)
    if birthdate:
        suggestions["birthdate"] = birthdate

    address = _labelled(lines, ("address", "tirahan", "residence"))
    if address and _looks_like_words(address):
        suggestions["street"] = address[:120]

    names = _name_lines(lines)
    if names:
        # The longest capitalised line is the likeliest full name: a card prints
        # it larger and OCR keeps it on one line more often than not.
        best = max(names, key=len)
        parts = [p for p in re.split(r"[,\s]+", best) if p]
        if len(parts) >= 2:
            suggestions["first_name"] = parts[0].title()
            suggestions["last_name"] = parts[-1].title()
            if len(parts) > 2:
                suggestions["middle_name"] = " ".join(parts[1:-1]).title()

    return {"suggestions": suggestions, "text_found": True}
