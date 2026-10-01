"""Password hashing (Argon2id) and token primitives."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import get_settings

Audience = Literal["resident", "staff"]

ISSUER = "beacon-api"
JWT_ALGORITHM = "HS256"

_hasher = PasswordHasher()  # Argon2id with the library's recommended parameters

# Verified against when an account does not exist, so a login attempt takes the
# same time whether or not the email/mobile number is registered.
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


class InvalidTokenError(Exception):
    pass


def create_access_token(user_id: uuid.UUID, role: str, audience: Audience) -> tuple[str, int]:
    """Return (token, lifetime in seconds). Tokens are bound to one app via `aud`."""
    settings = get_settings()
    lifetime = settings.access_token_minutes * 60
    now = datetime.now(UTC)
    claims = {
        "iss": ISSUER,
        "aud": audience,
        "sub": str(user_id),
        "role": role,
        "typ": "access",
        "iat": now,
        "exp": now + timedelta(seconds=lifetime),
        "jti": secrets.token_hex(8),
    }
    return jwt.encode(claims, settings.secret_key, algorithm=JWT_ALGORITHM), lifetime


def decode_access_token(token: str, audience: Audience) -> dict[str, Any]:
    try:
        claims = jwt.decode(
            token,
            get_settings().secret_key,
            algorithms=[JWT_ALGORITHM],
            audience=audience,
            issuer=ISSUER,
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
    except jwt.PyJWTError as exc:
        raise InvalidTokenError(str(exc)) from exc
    if claims.get("typ") != "access":
        raise InvalidTokenError("not an access token")
    return claims


def new_refresh_token() -> tuple[str, str]:
    """Return (raw token for the cookie, SHA-256 hash for the database)."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
