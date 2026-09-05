import cloudinary
import cloudinary.uploader
from core.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)


def upload_image(file_bytes: bytes, filename: str) -> str:
    """Upload image bytes to Cloudinary and return the secure URL.

    An incoming transformation is applied so the STORED asset is downsized and
    compressed (caps the longest side at 1600px, auto quality/format). This keeps
    evidence photos legible while sharply cutting cloud storage usage.
    """
    result = cloudinary.uploader.upload(
        file_bytes,
        folder="vawc-response/reports",
        public_id=filename,
        overwrite=True,
        resource_type="image",
        transformation=[{
            "width": 1600, "height": 1600, "crop": "limit",
            "quality": "auto:good", "fetch_format": "auto",
        }],
    )
    return result["secure_url"]
