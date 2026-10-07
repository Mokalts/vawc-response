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


def _signed_url(public_id: str, delivery: str) -> str:
    url, _ = cloudinary.utils.cloudinary_url(
        public_id,
        resource_type="image",
        type=delivery,
        sign_url=True,
        secure=True,
    )
    return url


def fetch_bytes(public_id_or_url: str):
    """Download an asset server-side. Returns (bytes, content_type) or (None, None).

    Two delivery types have to be tried, because the store holds both.

    Anything uploaded since this app started asking for private assets is
    `authenticated`, and signing is the only way to read it. Anything older is
    an ordinary `upload`, which a signature for `authenticated` does not match:
    Cloudinary answers 404 for an asset that exists, and the page shows a broken
    image. That is what happened to every evidence photograph filed before the
    change, which is most of them.

    So: try authenticated, fall back to upload. Nothing is weakened by the
    fallback. An old asset was already public and this does not make it more so,
    since the Cloudinary link never leaves this server either way; the browser
    only ever gets an expiring link to /media/photo. Running the migration that
    flips the old assets to authenticated retires the fallback for good.

    A stored value that is already a full URL is fetched as-is, which is how
    reports filed before public ids were stored still work.
    """
    if not public_id_or_url:
        return None, None

    value = str(public_id_or_url)
    import requests

    if value.startswith("http://") or value.startswith("https://"):
        candidates = [("stored url", value)]
    else:
        candidates = [
            ("authenticated", _signed_url(value, "authenticated")),
            ("upload", _signed_url(value, "upload")),
        ]

    last = None
    for label, url in candidates:
        try:
            r = requests.get(url, timeout=20)
        except Exception as e:  # noqa: BLE001
            last = f"{label}: {e}"
            continue
        if r.status_code == 200:
            return r.content, r.headers.get("Content-Type", "image/jpeg")
        last = f"{label}: HTTP {r.status_code}"

    print(f"[CLOUDINARY] could not fetch {public_id_or_url} ({last})")
    return None, None


def destroy_image(public_id: str) -> bool:
    """Delete an asset outright. Used for ID photographs once an officer has
    decided on them: the verification is the record worth keeping, not the
    photograph of her ID. Never raises, because failing to delete must not fail
    the decision that triggered it."""
    if not public_id:
        return False

    # Both delivery types, for the same reason fetch_bytes tries both: an asset
    # stored as an ordinary upload is not found by a destroy aimed at
    # authenticated, and a photograph of someone ID that silently fails to
    # delete is the worst way for this to go wrong.
    last = None
    for delivery in ("authenticated", "upload"):
        try:
            result = cloudinary.uploader.destroy(
                public_id, resource_type="image", type=delivery, invalidate=True
            )
            if result.get("result") == "ok":
                return True
            last = f"{delivery}: {result}"
        except Exception as e:  # noqa: BLE001
            last = f"{delivery}: {e}"

    print(f"[CLOUDINARY] could not destroy {public_id} ({last})")
    return False
