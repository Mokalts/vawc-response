import time

import cloudinary
import cloudinary.uploader
import cloudinary.utils
from core.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)

# How long a signed link stays usable. Long enough to open a case, scroll through
# the photographs and print, short enough that a link copied out of the page or
# left in a browser history is useless by the time anyone else finds it.
SIGNED_URL_TTL_SECONDS = 60 * 30


def upload_image(file_bytes: bytes, filename: str, folder: str = "vawc-response/reports") -> str:
    """Upload image bytes and return the stored asset's public id.

    Uploaded as `type="authenticated"`, which is the whole point: a default
    Cloudinary upload is readable by anyone holding the link, with no sign-in.
    For evidence photographs of a VAWC case, and for a photograph of a
    government ID, that is the difference between a private record and a public
    one. Authenticated assets cannot be fetched without a signature, so the URL
    alone is worth nothing.

    Returns the PUBLIC ID, not a URL. A signed URL expires, so storing one in
    the database would mean storing something that stops working; the id is the
    durable handle and `signed_url()` turns it into a link when someone with a
    session actually asks for it.

    The incoming transformation downsizes and compresses the stored asset,
    keeping photographs legible while cutting storage sharply.
    """
    result = cloudinary.uploader.upload(
        file_bytes,
        folder=folder,
        public_id=filename,
        overwrite=True,
        resource_type="image",
        type="authenticated",
        transformation=[{
            "width": 1600, "height": 1600, "crop": "limit",
            "quality": "auto:good", "fetch_format": "auto",
        }],
    )
    return result["public_id"]


def _delivery_url(public_id_or_url: str):
    """The URL this server uses to fetch an asset. Never given to a browser.

    Cloudinary's signed URLs do not expire on this account: expiry needs
    token-based authentication, which is a paid feature and has no key
    configured here. A signed link would therefore work forever for anyone who
    came across it, which is the problem we are fixing, so signed links are used
    only between this server and Cloudinary. Browsers get a short-lived link to
    THIS api instead (see routers/media.py).

    Tolerates a full URL as well as a public id, because reports filed before
    authenticated delivery stored the URL itself.
    """
    if not public_id_or_url:
        return None

    value = str(public_id_or_url)
    if value.startswith("http://") or value.startswith("https://"):
        return value

    url, _ = cloudinary.utils.cloudinary_url(
        value,
        resource_type="image",
        type="authenticated",
        sign_url=True,
        secure=True,
    )
    return url


def fetch_bytes(public_id_or_url: str):
    """Download an asset server-side. Returns (bytes, content_type) or (None, None)."""
    url = _delivery_url(public_id_or_url)
    if not url:
        return None, None
    try:
        import requests
        r = requests.get(url, timeout=20)
        if r.status_code != 200:
            print(f"[CLOUDINARY] fetch {public_id_or_url} -> {r.status_code}")
            return None, None
        return r.content, r.headers.get("Content-Type", "image/jpeg")
    except Exception as e:  # noqa: BLE001
        print(f"[CLOUDINARY] fetch failed for {public_id_or_url}: {e}")
        return None, None


def destroy_image(public_id: str) -> bool:
    """Delete an asset outright. Used for ID photographs once an officer has
    decided on them: the verification is the record worth keeping, not the
    photograph of her ID. Never raises, because failing to delete must not fail
    the decision that triggered it."""
    if not public_id:
        return False
    try:
        result = cloudinary.uploader.destroy(
            public_id, resource_type="image", type="authenticated", invalidate=True
        )
        ok = result.get("result") == "ok"
        if not ok:
            print(f"[CLOUDINARY] could not destroy {public_id}: {result}")
        return ok
    except Exception as e:  # noqa: BLE001
        print(f"[CLOUDINARY] destroy failed for {public_id}: {e}")
        return False
