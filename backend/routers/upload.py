from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from core.dependencies import get_current_user
from models.user import User
from utils.cloudinary_helper import upload_image
import uuid

router = APIRouter(prefix="/upload", tags=["Upload"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
MAX_SIZE_MB = 10


@router.post("/image")
async def upload_report_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WEBP, or HEIC images are allowed.")

    file_bytes = await file.read()

    if len(file_bytes) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max size is {MAX_SIZE_MB}MB.")

    filename = f"user_{current_user.id}_{uuid.uuid4().hex}"
    url = upload_image(file_bytes, filename)

    return {"url": url}
