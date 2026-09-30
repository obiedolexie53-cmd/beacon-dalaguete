from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog, RefreshToken, User, UserRole
from tests.factories import PASSWORD, make_user, registration

pytestmark = pytest.mark.db


def login(api: TestClient, identifier: str, password: str = PASSWORD, *, staff: bool = False):
    path = "/api/v1/staff/auth/login" if staff else "/api/v1/auth/login"
    return api.post(path, json={"identifier": identifier, "password": password})


def bearer(response) -> dict[str, str]:
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


# ---------- Registration ----------


def test_register_creates_resident_session(api: TestClient, db: Session) -> None:
    response = api.post("/api/v1/auth/register", json=registration(db))
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["role"] == "resident"
    assert body["user"]["phone"] == "+639171234567"
    assert body["user"]["barangay"]["name"] == "Mantalongon"

    cookie = response.headers["set-cookie"]
    assert "beacon_rt=" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/api/v1/auth" in cookie
    assert "SameSite=strict" in cookie

    user = db.scalar(select(User).where(User.email == "leona@example.com"))
    assert user.password_hash.startswith("$argon2id$")
    assert user.privacy_consent_at is not None
    assert db.scalar(select(AuditLog).where(AuditLog.action == "account.registered"))


def test_register_cannot_create_staff_accounts(api: TestClient, db: Session) -> None:
    response = api.post("/api/v1/auth/register", json=registration(db, role="admin"))
    assert response.status_code == 201
    assert response.json()["user"]["role"] == "resident"


def test_register_with_mobile_number_only(api: TestClient, db: Session) -> None:
    response = api.post("/api/v1/auth/register", json=registration(db, email=None))
    assert response.status_code == 201
    assert response.json()["user"]["email"] is None


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"privacy_consent": False}, "privacy_consent"),
        ({"email": None, "phone": None}, "request"),
        ({"password": "short"}, "password"),
        ({"password": "password123"}, "password"),
        ({"password": "leona@example.com1"}, "password"),
        ({"phone": "12345"}, "phone"),
        ({"email": "not-an-email"}, "email"),
        ({"full_name": " "}, "full_name"),
    ],
)
def test_register_validation(api: TestClient, db: Session, overrides: dict, field: str) -> None:
    response = api.post("/api/v1/auth/register", json=registration(db, **overrides))
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert field in error["fields"]


def test_register_rejects_unknown_barangay(api: TestClient, db: Session) -> None:
    response = api.post("/api/v1/auth/register", json=registration(db, barangay_id=999_999))
    assert response.status_code == 422
    assert "barangay_id" in response.json()["error"]["fields"]


def test_register_rejects_duplicate_contact(api: TestClient, db: Session) -> None:
    make_user(db, email="leona@example.com")
    response = api.post("/api/v1/auth/register", json=registration(db))
    assert response.status_code == 409
    assert response.json()["error"]["fields"] == {
        "email": "An account with this email already exists"
    }


# ---------- Login ----------


@pytest.mark.parametrize("identifier", ["Resident@Example.com", "09171234567", "+63 917 123 4567"])
def test_login_with_email_or_mobile(api: TestClient, db: Session, identifier: str) -> None:
    make_user(db, email="resident@example.com", phone="+639171234567")
    response = login(api, identifier)
    assert response.status_code == 200
    assert api.get("/api/v1/me", headers=bearer(response)).json()["email"] == (
        "resident@example.com"
    )


def test_wrong_password_and_unknown_account_look_the_same(api: TestClient, db: Session) -> None:
    make_user(db)
    wrong = login(api, "resident@example.com", "Wrong-Pass-2026")
    unknown = login(api, "nobody@example.com")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert wrong.json()["error"]["code"] == "invalid_credentials"


def test_account_locks_after_repeated_failures(api: TestClient, db: Session) -> None:
    user = make_user(db)
    for _ in range(5):
        assert login(api, "resident@example.com", "Wrong-Pass-2026").status_code == 401
    locked = login(api, "resident@example.com")  # even the correct password is refused
    assert locked.status_code == 429
    assert locked.json()["error"]["code"] == "account_locked"
    assert "Retry-After" in locked.headers

    user.locked_until = datetime.now(UTC) - timedelta(seconds=1)
    db.commit()
    assert login(api, "resident@example.com").status_code == 200


def test_disabled_account_cannot_log_in(api: TestClient, db: Session) -> None:
    make_user(db, is_active=False)
    response = login(api, "resident@example.com")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "account_disabled"


# ---------- Role separation ----------


def test_residents_cannot_use_staff_login(api: TestClient, db: Session) -> None:
    make_user(db)
    assert login(api, "resident@example.com", staff=True).status_code == 401


def test_staff_cannot_use_resident_login(api: TestClient, db: Session) -> None:
    make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")
    assert login(api, "officer@example.gov.ph").status_code == 401
    assert login(api, "officer@example.gov.ph", staff=True).status_code == 200


def test_tokens_only_work_in_their_own_app(api: TestClient, db: Session) -> None:
    make_user(db)
    make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")
    resident = bearer(login(api, "resident@example.com"))
    staff = bearer(login(api, "officer@example.gov.ph", staff=True))

    assert api.get("/api/v1/me", headers=resident).status_code == 200
    assert api.get("/api/v1/staff/me", headers=resident).status_code == 401
    assert api.get("/api/v1/staff/me", headers=staff).status_code == 200
    assert api.get("/api/v1/me", headers=staff).status_code == 401


def test_protected_routes_require_a_valid_token(api: TestClient) -> None:
    assert api.get("/api/v1/me").json()["error"]["code"] == "not_authenticated"
    assert api.get("/api/v1/me", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_disabling_an_account_revokes_access_immediately(api: TestClient, db: Session) -> None:
    user = make_user(db)
    headers = bearer(login(api, "resident@example.com"))
    user.is_active = False
    db.commit()
    assert api.get("/api/v1/me", headers=headers).status_code == 401


# ---------- Refresh & logout ----------


def test_refresh_rotates_the_token(api: TestClient, db: Session) -> None:
    make_user(db)
    login(api, "resident@example.com")
    first = api.cookies.get("beacon_rt")

    response = api.post("/api/v1/auth/refresh")
    assert response.status_code == 200
    assert response.json()["access_token"]
    assert api.cookies.get("beacon_rt") != first


def test_reusing_a_rotated_token_ends_the_whole_session(api: TestClient, db: Session) -> None:
    make_user(db)
    login(api, "resident@example.com")
    stolen = api.cookies.get("beacon_rt")
    assert api.post("/api/v1/auth/refresh").status_code == 200
    current = api.cookies.get("beacon_rt")

    # Outside the concurrent-refresh grace window, reuse means theft.
    rotated = db.scalar(select(RefreshToken).where(RefreshToken.revoked_at.is_not(None)))
    rotated.revoked_at = datetime.now(UTC) - timedelta(minutes=1)
    db.commit()

    api.cookies.set("beacon_rt", stolen, path="/api/v1/auth")
    reuse = api.post("/api/v1/auth/refresh")
    assert reuse.status_code == 401
    assert reuse.json()["error"]["code"] == "session_expired"

    api.cookies.set("beacon_rt", current, path="/api/v1/auth")
    assert api.post("/api/v1/auth/refresh").status_code == 401
    assert (
        db.scalar(
            select(func.count()).select_from(RefreshToken).where(RefreshToken.revoked_at.is_(None))
        )
        == 0
    )


def test_concurrent_refresh_does_not_end_the_session(api: TestClient, db: Session) -> None:
    make_user(db)
    login(api, "resident@example.com")
    old = api.cookies.get("beacon_rt")
    assert api.post("/api/v1/auth/refresh").status_code == 200  # "tab A"
    current = api.cookies.get("beacon_rt")

    api.cookies.set("beacon_rt", old, path="/api/v1/auth")  # "tab B" still had the old token
    race = api.post("/api/v1/auth/refresh")
    assert race.status_code == 409
    assert race.json()["error"]["code"] == "refresh_in_progress"
    assert "set-cookie" not in race.headers  # must not wipe tab A's new cookie

    api.cookies.set("beacon_rt", current, path="/api/v1/auth")
    assert api.post("/api/v1/auth/refresh").status_code == 200


def test_old_token_after_logout_is_not_treated_as_a_race(api: TestClient, db: Session) -> None:
    make_user(db)
    login(api, "resident@example.com")
    old = api.cookies.get("beacon_rt")
    api.post("/api/v1/auth/refresh")
    api.post("/api/v1/auth/logout")
    api.cookies.set("beacon_rt", old, path="/api/v1/auth")
    assert api.post("/api/v1/auth/refresh").json()["error"]["code"] == "session_expired"


def test_refresh_without_cookie_fails_and_clears_cookie(api: TestClient) -> None:
    response = api.post("/api/v1/auth/refresh")
    assert response.status_code == 401
    assert 'beacon_rt=""' in response.headers.get("set-cookie", "")


def test_expired_refresh_token_is_rejected(api: TestClient, db: Session) -> None:
    make_user(db)
    login(api, "resident@example.com")
    for token in db.scalars(select(RefreshToken)):
        token.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db.commit()
    assert api.post("/api/v1/auth/refresh").status_code == 401


def test_logout_revokes_the_session(api: TestClient, db: Session) -> None:
    make_user(db)
    login(api, "resident@example.com")
    assert api.post("/api/v1/auth/logout").status_code == 204
    assert api.post("/api/v1/auth/refresh").status_code == 401


def test_staff_refresh_cookie_is_separate(api: TestClient, db: Session) -> None:
    make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")
    response = login(api, "officer@example.gov.ph", staff=True)
    assert "beacon_staff_rt=" in response.headers["set-cookie"]
    assert "Path=/api/v1/staff/auth" in response.headers["set-cookie"]
    assert api.post("/api/v1/staff/auth/refresh").status_code == 200
    assert api.post("/api/v1/auth/refresh").status_code == 401


# ---------- Barangays ----------


def test_barangay_list_is_public(api: TestClient) -> None:
    names = [b["name"] for b in api.get("/api/v1/barangays").json()]
    assert len(names) == 33
    assert "Mantalongon" in names
    assert names == sorted(names)
