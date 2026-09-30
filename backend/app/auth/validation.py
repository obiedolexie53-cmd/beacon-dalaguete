"""Input rules for account fields."""

import re

PRIVACY_NOTICE_VERSION = "2026-09"

_MOBILE_RE = re.compile(r"^(?:\+?63|0)?(9\d{9})$")

# A short blocklist of passwords that appear at the top of every breach list.
_COMMON_PASSWORDS = frozenset(
    {
        "password",
        "password1",
        "password123",
        "12345678",
        "123456789",
        "1234567890",
        "qwerty123",
        "11111111",
        "00000000",
        "iloveyou",
        "abcd1234",
        "beacon123",
        "dalaguete",
        "admin123",
    }
)

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def normalize_ph_mobile(value: str) -> str:
    """Normalize a Philippine mobile number to E.164 (+639XXXXXXXXX).

    Accepts 09171234567, 9171234567, 639171234567 and +63 917 123 4567.
    """
    compact = re.sub(r"[\s\-().]", "", value)
    match = _MOBILE_RE.match(compact)
    if not match:
        raise ValueError("Enter a valid Philippine mobile number, e.g. 0917 123 4567")
    return f"+63{match.group(1)}"


def check_password_strength(password: str, *, identifiers: tuple[str | None, ...] = ()) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Use at least {MIN_PASSWORD_LENGTH} characters")
    if len(password) > MAX_PASSWORD_LENGTH:
        raise ValueError(f"Use at most {MAX_PASSWORD_LENGTH} characters")
    lowered = password.lower()
    if lowered in _COMMON_PASSWORDS or len(set(password)) < 3:
        raise ValueError("This password is too easy to guess")
    for identifier in identifiers:
        if identifier and identifier.lower().lstrip("+") in lowered:
            raise ValueError("Do not use your email or mobile number in your password")


def looks_like_email(identifier: str) -> bool:
    return "@" in identifier
