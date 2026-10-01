"""Access-control matrix: every API operation, with every kind of caller.

Every operation in the OpenAPI schema must be listed in ACCESS below, so a new
route cannot be added without deciding who may call it.
"""

import time
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.media.signing import signed_media_url
from app.models import UserRole
from tests.factories import PASSWORD, make_report, make_user

pytestmark = pytest.mark.db

PUBLIC, RESIDENT, STAFF, SIGNED = "public", "resident", "staff", "signed link"

ACCESS = {
    "GET /api/v1/health": PUBLIC,
    "GET /api/v1/health/db": PUBLIC,
    "GET /api/v1/barangays": PUBLIC,
    "GET /api/v1/hazard-types": PUBLIC,
    "POST /api/v1/auth/login": PUBLIC,
    "POST /api/v1/auth/refresh": PUBLIC,
    "POST /api/v1/auth/logout": PUBLIC,
    "POST /api/v1/auth/register": PUBLIC,
    "POST /api/v1/staff/auth/login": PUBLIC,
    "POST /api/v1/staff/auth/refresh": PUBLIC,
    "POST /api/v1/staff/auth/logout": PUBLIC,
    "GET /api/v1/media/{media_id}": SIGNED,
    "GET /api/v1/me": RESIDENT,
    "GET /api/v1/me/dashboard": RESIDENT,
    "GET /api/v1/me/reports": RESIDENT,
    "POST /api/v1/me/reports": RESIDENT,
    "GET /api/v1/me/reports/{reference_no}": RESIDENT,
    "POST /api/v1/me/reports/{reference_no}/media": RESIDENT,
    "GET /api/v1/me/reports/{reference_no}/media": RESIDENT,
    "GET /api/v1/me/notifications": RESIDENT,
    "GET /api/v1/me/notifications/unread-count": RESIDENT,
    "POST /api/v1/me/notifications/read-all": RESIDENT,
    "POST /api/v1/me/notifications/{notification_id}/read": RESIDENT,
    "GET /api/v1/staff/me": STAFF,
    "GET /api/v1/staff/dashboard": STAFF,
    "GET /api/v1/staff/reports": STAFF,
    "GET /api/v1/staff/reports/{reference_no}": STAFF,
    "POST /api/v1/staff/reports/{reference_no}/status": STAFF,
    "GET /api/v1/staff/map/reports": STAFF,
    "GET /api/v1/staff/analysis/incidents": STAFF,
    "GET /api/v1/staff/analysis/patterns": STAFF,
    "GET /api/v1/staff/analysis/incidents/export": STAFF,
}


def operations() -> list[tuple[str, str]]:
    return [
        (method.upper(), path) for path, ops in app.openapi()["paths"].items() for method in ops
    ]


def test_every_operation_is_classified() -> None:
    found = {f"{m} {p}" for m, p in operations()}
    assert found - ACCESS.keys() == set(), "classify new routes in ACCESS"
    assert ACCESS.keys() - found == set(), "remove routes that no longer exist"


def _login(api: TestClient, path: str, identifier: str) -> dict[str, str]:
    token = api.post(path, json={"identifier": identifier, "password": PASSWORD}).json()[
        "access_token"
    ]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def callers(api: TestClient, db: Session):
    owner = make_user(db, email="owner@example.com")
    make_user(db, email="other@example.com")
    make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")
    report = make_report(db, owner)
    return {
        "report": report.reference_no,
        "anonymous": {},
        "owner": _login(api, "/api/v1/auth/login", "owner@example.com"),
        "other": _login(api, "/api/v1/auth/login", "other@example.com"),
        "staff": _login(api, "/api/v1/staff/auth/login", "officer@example.gov.ph"),
        "garbage": {"Authorization": "Bearer not-a-real-token"},
    }


def _call(api: TestClient, method: str, path: str, headers: dict, report: str):
    url = (
        path.replace("{reference_no}", report)
        .replace("{media_id}", str(uuid.uuid4()))
        .replace("{notification_id}", str(uuid.uuid4()))
    )
    if method == "GET":
        return api.get(url, headers=headers)
    return api.post(url, headers=headers, json={})


def test_staff_routes_reject_everyone_but_staff(api: TestClient, callers) -> None:
    for key, kind in ACCESS.items():
        if kind != STAFF:
            continue
        method, path = key.split(" ", 1)
        for who in ("anonymous", "garbage", "owner", "other"):
            response = _call(api, method, path, callers[who], callers["report"])
            assert response.status_code == 401, (key, who, response.status_code)
        response = _call(api, method, path, callers["staff"], callers["report"])
        assert response.status_code not in (401, 403), (key, response.text)


def test_resident_routes_reject_anonymous_and_staff_tokens(api: TestClient, callers) -> None:
    for key, kind in ACCESS.items():
        if kind != RESIDENT:
            continue
        method, path = key.split(" ", 1)
        for who in ("anonymous", "garbage", "staff"):
            response = _call(api, method, path, callers[who], callers["report"])
            assert response.status_code == 401, (key, who, response.status_code)


def test_residents_cannot_reach_each_others_reports(api: TestClient, callers) -> None:
    ref = callers["report"]
    for method, path in (
        ("GET", "/api/v1/me/reports/{reference_no}"),
        ("GET", "/api/v1/me/reports/{reference_no}/media"),
        ("POST", "/api/v1/me/reports/{reference_no}/media"),
    ):
        other = _call(api, method, path, callers["other"], ref)
        # 404, not 403: another resident's reference number is not even confirmed to exist.
        assert other.status_code in (404, 422), (path, other.status_code)
    assert api.get(f"/api/v1/me/reports/{ref}", headers=callers["owner"]).status_code == 200
    listed = api.get("/api/v1/me/reports", headers=callers["other"]).json()
    assert ref not in str(listed)


def test_media_links_need_a_valid_unexpired_signature(api: TestClient) -> None:
    media_id = uuid.uuid4()
    assert api.get(f"/api/v1/media/{media_id}").status_code == 422
    assert api.get(f"/api/v1/media/{media_id}", params={"exp": 1, "sig": "x"}).status_code == 404
    expired = signed_media_url(media_id, now=time.time() - 60 * 60)
    assert api.get(expired).status_code == 404


def test_security_headers(api: TestClient, callers) -> None:
    response = api.get("/api/v1/me", headers=callers["owner"])
    for name, value in {
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "x-frame-options": "DENY",
        "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    }.items():
        assert response.headers[name] == value
    assert "strict-transport-security" not in response.headers  # HTTPS only (production)
    # Errors carry them too.
    assert api.get("/api/v1/me").headers["x-frame-options"] == "DENY"
