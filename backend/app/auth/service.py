"""Account registration, credential checks, lockout and refresh-token rotation."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy import exists, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit.service import record
from app.auth.schemas import RegisterRequest
from app.auth.validation import PRIVACY_NOTICE_VERSION, looks_like_email, normalize_ph_mobile
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.security import (
    Audience,
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    password_needs_rehash,
    verify_password,
)
from app.models import Barangay, RefreshToken, User, UserRole
from app.models.user import STAFF_ROLES

INVALID_CREDENTIALS = ApiError(
    status.HTTP_401_UNAUTHORIZED,
    "invalid_credentials",
    "Incorrect email/mobile number or password.",
)
SESSION_EXPIRED = ApiError(
    status.HTTP_401_UNAUTHORIZED,
    "session_expired",
    "Your session has ended. Please log in again.",
)

# Returned during the concurrent-refresh grace window. The client should retry
# shortly; the cookie is left alone because it now holds the other tab's new token.
REFRESH_IN_PROGRESS = ApiError(
    status.HTTP_409_CONFLICT,
    "refresh_in_progress",
    "Your session is being refreshed. Please retry.",
)

AUDIENCE_ROLES: dict[Audience, frozenset[UserRole]] = {
    "resident": frozenset({UserRole.RESIDENT}),
    "staff": STAFF_ROLES,
}


def _now() -> datetime:
    return datetime.now(UTC)


@dataclass
class IssuedSession:
    access_token: str
    expires_in: int
    refresh_token: str
    refresh_max_age: int
    user: User


def register_resident(db: Session, data: RegisterRequest, ip: str | None) -> User:
    if db.get(Barangay, data.barangay_id) is None:
        raise ApiError(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "validation_error",
            "Please check the highlighted fields.",
            {"barangay_id": "Select your barangay"},
        )

    conflicts: dict[str, str] = {}
    if data.email and db.scalar(select(User.id).where(User.email == data.email)):
        conflicts["email"] = "An account with this email already exists"
    if data.phone and db.scalar(select(User.id).where(User.phone == data.phone)):
        conflicts["phone"] = "An account with this mobile number already exists"
    if conflicts:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "account_exists",
            "An account already exists. Try logging in instead.",
            conflicts,
        )

    user = User(
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        password_hash=hash_password(data.password),
        role=UserRole.RESIDENT,  # Public registration can only ever create residents.
        barangay_id=data.barangay_id,
        privacy_consent_at=_now(),
        privacy_consent_version=PRIVACY_NOTICE_VERSION,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:  # concurrent registration with the same contact
        db.rollback()
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "account_exists",
            "An account already exists. Try logging in instead.",
        ) from exc
    record(db, "account.registered", actor_id=user.id, ip=ip, entity="user", entity_id=str(user.id))
    return user


def _find_by_identifier(db: Session, identifier: str) -> User | None:
    identifier = identifier.strip()
    if looks_like_email(identifier):
        return db.scalar(select(User).where(User.email == identifier.lower()))
    try:
        phone = normalize_ph_mobile(identifier)
    except ValueError:
        return None
    return db.scalar(select(User).where(User.phone == phone))


def authenticate(
    db: Session, identifier: str, password: str, audience: Audience, ip: str | None
) -> User:
    """Check credentials for one app. Staff cannot sign in to the resident app and vice versa."""
    settings = get_settings()
    user = _find_by_identifier(db, identifier)
    now = _now()

    if user and user.locked_until and user.locked_until > now:
        record(db, "auth.login_locked", actor_id=user.id, ip=ip)
        db.commit()
        minutes = max(1, int((user.locked_until - now).total_seconds() // 60) + 1)
        raise ApiError(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "account_locked",
            f"Too many failed attempts. Please try again in {minutes} minutes.",
            headers={"Retry-After": str(minutes * 60)},
        )

    # Always run a hash check so response time does not reveal whether an account exists.
    password_ok = verify_password(user.password_hash if user else None, password)
    if not user or not password_ok or user.role not in AUDIENCE_ROLES[audience]:
        if user and not password_ok:
            user.failed_login_count += 1
            if user.failed_login_count >= settings.max_failed_logins:
                user.locked_until = now + timedelta(minutes=settings.lockout_minutes)
                user.failed_login_count = 0
        record(
            db,
            "auth.login_failed",
            actor_id=user.id if user else None,
            ip=ip,
            details={"audience": audience},
        )
        db.commit()
        raise INVALID_CREDENTIALS

    if not user.is_active:
        record(db, "auth.login_disabled", actor_id=user.id, ip=ip)
        db.commit()
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            "account_disabled",
            "This account has been disabled. Please contact the Dalaguete MDRRMO.",
        )

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    record(db, "auth.login", actor_id=user.id, ip=ip, details={"audience": audience})
    return user


def _refresh_lifetime(audience: Audience) -> timedelta:
    settings = get_settings()
    if audience == "staff":
        return timedelta(hours=settings.staff_refresh_token_hours)
    return timedelta(days=settings.refresh_token_days)


def issue_session(
    db: Session,
    user: User,
    audience: Audience,
    user_agent: str | None,
    family_id: uuid.UUID | None = None,
) -> IssuedSession:
    lifetime = _refresh_lifetime(audience)
    raw, token_hash = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            family_id=family_id or uuid.uuid4(),
            token_hash=token_hash,
            expires_at=_now() + lifetime,
            user_agent=(user_agent or "")[:255] or None,
        )
    )
    access_token, expires_in = create_access_token(user.id, user.role.value, audience)
    db.commit()
    return IssuedSession(
        access_token=access_token,
        expires_in=expires_in,
        refresh_token=raw,
        refresh_max_age=int(lifetime.total_seconds()),
        user=user,
    )


def rotate_session(
    db: Session, raw_token: str | None, audience: Audience, user_agent: str | None, ip: str | None
) -> IssuedSession:
    """Exchange a refresh token for a new session, revoking the old token."""
    if not raw_token:
        raise SESSION_EXPIRED
    token = db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(raw_token))
        .with_for_update()
    )
    if token is None:
        raise SESSION_EXPIRED

    now = _now()
    if token.revoked_at is not None:
        grace = timedelta(seconds=get_settings().refresh_reuse_grace_seconds)
        family_still_active = db.scalar(
            select(
                exists().where(
                    RefreshToken.family_id == token.family_id, RefreshToken.revoked_at.is_(None)
                )
            )
        )
        if token.revoked_at > now - grace and family_still_active:
            # Two tabs refreshed at the same moment; the other one already holds
            # the new token. Refuse this request without ending the session.
            raise REFRESH_IN_PROGRESS
        # A rotated token was used again later: assume it was stolen and end
        # every session descended from the same login.
        db.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == token.family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        record(db, "auth.refresh_reuse_detected", actor_id=token.user_id, ip=ip)
        db.commit()
        raise SESSION_EXPIRED

    user = token.user
    if token.expires_at <= now or not user.is_active or user.role not in AUDIENCE_ROLES[audience]:
        token.revoked_at = now
        db.commit()
        raise SESSION_EXPIRED

    token.revoked_at = now
    return issue_session(db, user, audience, user_agent, family_id=token.family_id)


def revoke_session(db: Session, raw_token: str | None, ip: str | None) -> None:
    if not raw_token:
        return
    token = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token))
    )
    if token and token.revoked_at is None:
        token.revoked_at = _now()
        record(db, "auth.logout", actor_id=token.user_id, ip=ip)
        db.commit()
