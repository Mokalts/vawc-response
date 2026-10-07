from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
from core.security import decode_access_token
from models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    # A session token carries no "type". The typed ones are issued for a single
    # purpose, an email verification link, an ID submission, one image, and must
    # not be usable as a login: before this check, a verification link pasted
    # into an Authorization header opened the whole account.
    if payload.get("type"):
        raise credentials_exception

    user_id = int(payload.get("sub"))
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    # A deleted account must stop working the moment it is deleted. Only the
    # browser's copy of the token was being thrown away, so the token itself
    # stayed valid until it expired: anyone else holding it, on a shared phone
    # or from a device she no longer has, could still read her profile and file
    # reports from an account she had closed. The delete dialog promises she
    # will be signed out immediately, and this is what makes that true.
    if user is None or user.is_deleted:
        raise credentials_exception

    return user


def get_user_for_id_submission(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """The one place an ID-submission token is accepted.

    Takes a normal session too, so an officer-approved user can still replace
    her ID from her profile, and takes the single-purpose token minted at a
    refused sign-in, which is the only way someone locked out can send one at
    all.
    """
    from core.security import decode_id_submit_token

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id = decode_id_submit_token(token)
    if user_id is None:
        payload = decode_access_token(token)
        if payload is None or payload.get("type"):
            raise credentials_exception
        user_id = payload.get("sub")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or user.is_deleted:
        raise credentials_exception
    return user
