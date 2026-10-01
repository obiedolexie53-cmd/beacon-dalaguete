"""Authentication and role-based access dependencies.

Every protected route declares one of these. Access tokens are bound to an app
(`aud` = resident or staff), and the user is re-loaded on each request so a
disabled account loses access immediately.
"""

import uuid
from typing import Annotated

from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import ApiError
from app.core.security import Audience, InvalidTokenError, decode_access_token
from app.models import User, UserRole
from app.models.user import STAFF_ROLES

_bearer = HTTPBearer(auto_error=False)

NOT_AUTHENTICATED = ApiError(
    status.HTTP_401_UNAUTHORIZED,
    "not_authenticated",
    "Please log in to continue.",
    headers={"WWW-Authenticate": "Bearer"},
)
FORBIDDEN = ApiError(
    status.HTTP_403_FORBIDDEN,
    "forbidden",
    "You do not have permission to access this.",
)


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _load_user(
    db: Session,
    credentials: HTTPAuthorizationCredentials | None,
    audience: Audience,
    allowed_roles: frozenset[UserRole],
) -> User:
    if credentials is None:
        raise NOT_AUTHENTICATED
    try:
        claims = decode_access_token(credentials.credentials, audience)
        user_id = uuid.UUID(claims["sub"])
    except (InvalidTokenError, ValueError):
        raise NOT_AUTHENTICATED from None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise NOT_AUTHENTICATED
    if user.role not in allowed_roles:
        raise FORBIDDEN
    return user


Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
DbSession = Annotated[Session, Depends(get_db)]


def get_current_resident(db: DbSession, credentials: Credentials) -> User:
    return _load_user(db, credentials, "resident", frozenset({UserRole.RESIDENT}))


def get_current_staff(db: DbSession, credentials: Credentials) -> User:
    return _load_user(db, credentials, "staff", STAFF_ROLES)


def get_current_admin(db: DbSession, credentials: Credentials) -> User:
    return _load_user(db, credentials, "staff", frozenset({UserRole.ADMIN}))


CurrentResident = Annotated[User, Depends(get_current_resident)]
CurrentStaff = Annotated[User, Depends(get_current_staff)]
CurrentAdmin = Annotated[User, Depends(get_current_admin)]
