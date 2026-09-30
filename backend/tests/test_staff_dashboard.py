from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import UserRole
from app.reports.workflow import ReportStatus as S
from tests.factories import PASSWORD, make_report, make_user

pytestmark = pytest.mark.db


def staff_headers(api: TestClient, db: Session, role: UserRole = UserRole.MDRRMO) -> dict[str, str]:
    make_user(db, role=role, email="officer@example.gov.ph")
    token = api.post(
        "/api/v1/staff/auth/login",
        json={"identifier": "officer@example.gov.ph", "password": PASSWORD},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_dashboard_counts_every_residents_reports(api: TestClient, db: Session) -> None:
    leona = make_user(db, email="leona@example.com")
    other = make_user(db, email="other@example.com")
    for status in [S.SUBMITTED, S.SUBMITTED, S.UNDER_VERIFICATION, S.NEEDS_CLARIFICATION]:
        make_report(db, leona, status=status)
    for status in [S.VERIFIED, S.RESOLVED, S.RESOLVED]:
        make_report(db, other, status=status)

    body = api.get("/api/v1/staff/dashboard", headers=staff_headers(api, db)).json()
    assert body["counts"] == {
        "total": 7,
        "new": 2,
        "under_verification": 1,
        "needs_clarification": 1,
        "verified": 1,
        "resolved": 2,
    }


def test_recent_reports_are_newest_first_and_limited(api: TestClient, db: Session) -> None:
    leona = make_user(db, email="leona@example.com")
    now = datetime.now(UTC)
    refs = [
        make_report(db, leona, submitted_at=now - timedelta(minutes=i)).reference_no
        for i in range(12)
    ]
    rows = api.get("/api/v1/staff/dashboard", headers=staff_headers(api, db)).json()[
        "recent_reports"
    ]
    assert [r["reference_no"] for r in rows] == refs[:10]
    assert rows[0]["hazard_type"]["name"] == "Flood"
    assert rows[0]["barangay"]["name"] == "Mantalongon"
    assert "reporter" not in rows[0]  # no personal details in the overview


def test_demo_records_can_be_excluded(api: TestClient, db: Session) -> None:
    leona = make_user(db, email="leona@example.com")
    real = make_report(db, leona)
    demo = make_report(db, leona)
    demo.is_demo = True
    db.commit()
    headers = staff_headers(api, db)

    everything = api.get("/api/v1/staff/dashboard", headers=headers).json()
    assert everything["counts"]["total"] == 2
    real_only = api.get("/api/v1/staff/dashboard?include_demo=false", headers=headers).json()
    assert real_only["counts"]["total"] == 1
    assert [r["reference_no"] for r in real_only["recent_reports"]] == [real.reference_no]
    assert real_only["include_demo"] is False


def test_admins_can_see_the_dashboard(api: TestClient, db: Session) -> None:
    response = api.get("/api/v1/staff/dashboard", headers=staff_headers(api, db, UserRole.ADMIN))
    assert response.status_code == 200


def test_residents_cannot_see_the_dashboard(api: TestClient, db: Session) -> None:
    make_user(db, email="leona@example.com")
    token = api.post(
        "/api/v1/auth/login", json={"identifier": "leona@example.com", "password": PASSWORD}
    ).json()["access_token"]
    assert api.get("/api/v1/staff/dashboard").status_code == 401
    assert (
        api.get("/api/v1/staff/dashboard", headers={"Authorization": f"Bearer {token}"}).status_code
        == 401
    )
