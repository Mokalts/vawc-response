from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from database import get_db
from core.security import decode_access_token
from models.admin import Admin


def get_token_from_cookie(request: Request) -> str:
    token = request.cookies.get("admin_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
        )
    return token


def get_current_admin(
    request: Request,
    db: Session = Depends(get_db),
) -> Admin:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate admin credentials.",
    )
    token = get_token_from_cookie(request)
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    admin_id = payload.get("sub")
    if admin_id is None:
        raise credentials_exception

    admin = db.query(Admin).filter(Admin.id == int(admin_id)).first()
    if not admin or not admin.is_active:
        raise credentials_exception

    return admin


def get_current_admin_full_access(
    request: Request,
    db: Session = Depends(get_db),
) -> Admin:
    """Requires face verification to be completed."""
    admin = get_current_admin(request=request, db=db)
    token = get_token_from_cookie(request)
    payload = decode_access_token(token)
    if not payload.get("face_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Face verification required.",
        )
    return admin


def require_super_admin(
    request: Request,
    db: Session = Depends(get_db),
) -> Admin:
    """Only Super Admin can access this route. Canonical check is is_super_admin."""
    admin = get_current_admin(request=request, db=db)
    if not admin.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin access required.",
        )
    return admin