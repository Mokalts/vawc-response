"""
Field masking helpers for non-super-admin views.

Regular admins receive masked sensitive data over the wire. Super Admins
receive the full payload. The backend is the source of truth — never trust
the client to enforce masking.
"""
from typing import Optional


def mask_name(name: Optional[str]) -> Optional[str]:
    """'Maria Santos' -> 'M**** S******'."""
    if not name:
        return name
    parts = name.split()
    masked = []
    for p in parts:
        if len(p) <= 1:
            masked.append(p)
        else:
            masked.append(p[0] + "*" * (len(p) - 1))
    return " ".join(masked)


def mask_last_initial(name: Optional[str]) -> Optional[str]:
    """'Maria Santos' -> 'Maria S.'  (keeps first name + last initial — case-identifiable)."""
    if not name:
        return name
    parts = [p for p in name.split() if p.strip()]
    if len(parts) == 0:
        return name
    if len(parts) == 1:
        return parts[0]
    first = parts[0]
    last_initial = parts[-1][0] + "."
    return f"{first} {last_initial}"


def mask_email(email: Optional[str]) -> Optional[str]:
    """'maria@gmail.com' -> 'm****@gmail.com'."""
    if not email or "@" not in email:
        return email
    local, _, domain = email.partition("@")
    if len(local) <= 1:
        return f"{local}@{domain}"
    return f"{local[0]}{'*' * (len(local) - 1)}@{domain}"


def mask_phone(phone: Optional[str]) -> Optional[str]:
    """'+639175995449' -> '+63 9** *** *449'  (keeps first 3 + last 4)."""
    if not phone:
        return phone
    digits = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    if len(digits) < 7:
        return "*" * len(phone)
    head = digits[:3]
    tail = digits[-4:]
    return f"{head} *** *** {tail}"


def mask_address(address: Optional[str]) -> Optional[str]:
    """Keeps the tail (usually city / barangay / province), masks the head (street, house no.)."""
    if not address:
        return address
    a = address.strip()
    if "," in a:
        # Keep everything after the first comma (usually city/barangay)
        head, _, tail = a.partition(",")
        return f"[Street masked],{tail}"
    if len(a) <= 24:
        return "[Street masked]"
    return f"[Street masked]{a[-24:]}"


def mask_statement(statement: Optional[str]) -> str:
    """Short preview + restriction notice."""
    if not statement:
        return ""
    snippet = statement.strip()[:60]
    if len(statement.strip()) > 60:
        snippet += "..."
    return f"{snippet}  [Restricted — Super Admin access required to view full statement.]"


def mask_dob(dob):
    """Hide year-month-day; return None to fully hide. Frontend will render '—'."""
    return None


def mask_victim(victim: dict) -> dict:
    """Apply mask to a victim sub-object (mutates a copy)."""
    if not victim:
        return victim
    v = dict(victim)
    if "first_name" in v:
        v["first_name"] = v.get("first_name")  # keep first name
    if "middle_name" in v:
        v["middle_name"] = None
    if "last_name" in v and v.get("last_name"):
        ln = v["last_name"]
        v["last_name"] = ln[0] + "." if ln else ln
    if "full_name" in v:
        v["full_name"] = mask_last_initial(v.get("full_name"))
    if "email" in v:
        v["email"] = mask_email(v.get("email"))
    if "phone_number" in v:
        v["phone_number"] = mask_phone(v.get("phone_number"))
    if "address" in v:
        v["address"] = mask_address(v.get("address"))
    if "date_of_birth" in v:
        v["date_of_birth"] = None
    if "birthdate" in v:
        v["birthdate"] = None
    if "guardian_name" in v:
        v["guardian_name"] = mask_name(v.get("guardian_name"))
    # Keep: sex, is_minor, guardian_relationship (not personally identifying alone)
    return v


def mask_case_dict(data: dict) -> dict:
    """Apply masking to a fully-decrypted case dict (returned by _decrypt_case)."""
    data["offender_name"] = mask_name(data.get("offender_name"))
    data["victim_name"]   = mask_last_initial(data.get("victim_name"))
    data["victim_email"]  = mask_email(data.get("victim_email"))
    data["victim_phone"]  = mask_phone(data.get("victim_phone"))
    if "victim" in data and data["victim"]:
        data["victim"] = mask_victim(data["victim"])
    if "reports" in data and data["reports"]:
        data["reports"] = [mask_report_dict(r) for r in data["reports"]]
    data["restricted"] = True
    return data


def mask_report_dict(data: dict) -> dict:
    """Apply masking to a fully-decrypted report dict (returned by _decrypt_report)."""
    if "offender_name" in data:
        data["offender_name"] = mask_name(data.get("offender_name"))
    if "statement" in data:
        data["statement"] = mask_statement(data.get("statement"))
    if "latitude" in data:
        data["latitude"] = None
    if "longitude" in data:
        data["longitude"] = None
    if "address" in data:
        data["address"] = mask_address(data.get("address"))
    photo_urls = data.get("photo_urls") or []
    data["photo_count"] = len(photo_urls)
    data["photo_urls"]  = []  # never leak Cloudinary URLs to regular admins
    if "victim_name" in data:
        data["victim_name"] = mask_last_initial(data.get("victim_name"))
    if "victim_contact" in data:
        data["victim_contact"] = mask_phone(data.get("victim_contact"))
    if "victim_email" in data:
        data["victim_email"] = mask_email(data.get("victim_email"))
    if "victim" in data and data["victim"]:
        data["victim"] = mask_victim(data["victim"])
    data["restricted"] = True
    return data


def mark_unrestricted(data: dict) -> dict:
    """Tag a Super Admin response as unrestricted + add photo_count for symmetry."""
    if "photo_urls" in data:
        data["photo_count"] = len(data.get("photo_urls") or [])
    if "reports" in data and data["reports"]:
        for r in data["reports"]:
            if "photo_urls" in r:
                r["photo_count"] = len(r.get("photo_urls") or [])
            r["restricted"] = False
    data["restricted"] = False
    return data
