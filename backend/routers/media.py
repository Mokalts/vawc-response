"""Serving case images without making them public.

Evidence photographs used to be delivered straight from Cloudinary at a default
upload URL: unguessable, but readable by anyone who had the link, with no
sign-in and for ever. For photographs of a VAWC incident, and now for
photographs of a government ID, that is the difference between a private record
and a public one.

Assets are uploaded as `authenticated` and their Cloudinary links never leave
this server. A browser gets a link to THIS endpoint instead, carrying a token
that names one image and expires in half an hour. A link copied out of the page,
or left in a browser's history, stops working.

The token is not a session. It says "whoever holds this may see this one image
for the next thirty minutes", and it is only ever handed to a caller that has
already been authorised for the case it belongs to.
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from fastapi import Depends

from database import get_db
from models.report import Report
from models.user import User
from core.security import decode_media_token
from utils.cloudinary_helper import fetch_bytes

router = APIRouter(prefix="/media", tags=["Media"])


@router.get("/photo")
def get_photo(
    t: str = Query(..., description="Short-lived media token"),
    db: Session = Depends(get_db),
):
    ref = decode_media_token(t)
    if not ref:
        # Same answer for forged, malformed and expired. A caller poking at this
        # endpoint learns only that the link is no good, never why.
        raise HTTPException(status_code=403, detail="This image link has expired. Reload the page.")

    kind, _, rest = ref.partition(":")

    if kind == "report":
        report_id, _, index = rest.partition(":")
        report = db.query(Report).filter(Report.id == int(report_id)).first()
        if not report:
            raise HTTPException(status_code=404, detail="Image not found.")
        handles = report.photo_urls or []
        try:
            handle = handles[int(index)]
        except (ValueError, IndexError):
            raise HTTPException(status_code=404, detail="Image not found.")

    elif kind == "id":
        user = db.query(User).filter(User.id == int(rest)).first()
        if not user or not user.id_document:
            raise HTTPException(status_code=404, detail="Image not found.")
        handle = user.id_document

    else:
        raise HTTPException(status_code=403, detail="This image link has expired. Reload the page.")

    data, content_type = fetch_bytes(handle)
    if not data:
        raise HTTPException(status_code=404, detail="Image not found.")

    return Response(
        content=data,
        media_type=content_type,
        headers={
            # Cacheable for the life of the token and no longer, and private so
            # no shared proxy keeps a copy of someone's evidence photograph.
            "Cache-Control": "private, max-age=1800",
            "X-Content-Type-Options": "nosniff",
        },
    )
