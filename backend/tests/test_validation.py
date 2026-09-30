import pytest

from app.auth.validation import check_password_strength, normalize_ph_mobile


@pytest.mark.parametrize(
    "raw", ["09171234567", "9171234567", "639171234567", "+63 917 123 4567", "0917-123-4567"]
)
def test_normalize_ph_mobile(raw: str) -> None:
    assert normalize_ph_mobile(raw) == "+639171234567"


@pytest.mark.parametrize("raw", ["0817123456", "12345", "+1 415 555 0100", "0917123456"])
def test_rejects_invalid_mobile(raw: str) -> None:
    with pytest.raises(ValueError):
        normalize_ph_mobile(raw)


@pytest.mark.parametrize("password", ["short", "password123", "aaaaaaaaaa"])
def test_rejects_weak_passwords(password: str) -> None:
    with pytest.raises(ValueError):
        check_password_strength(password)


def test_rejects_password_containing_identifier() -> None:
    with pytest.raises(ValueError):
        check_password_strength("leona@example.com!", identifiers=("leona@example.com",))
    check_password_strength("Safe-Pass-2026", identifiers=("leona@example.com",))
