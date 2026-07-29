import cloudinary
import cloudinary.uploader
from core.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)


def upload_image(file_bytes: bytes, filename: str) -> str:
    """Upload image bytes to Cloudinary and return the secure URL."""
    result = cloudinary.uploader.upload(
        file_bytes,
        folder="vawc-response/reports",
        public_id=filename,
        overwrite=True,
        resource_type="image",
    )
    return result["secure_url"]
