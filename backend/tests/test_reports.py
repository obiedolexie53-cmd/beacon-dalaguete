from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cli import seed_demo
from app.models import Report, UserRole
from app.reports.reference import allocate_reference_number, reserve_reference_number
from app.reports.workflow import ReportStatus as S
from tests.factories import PASSWORD, make_report, make_user

pytestmark = pytest.mark.db


def resident_headers(api: TestClient, email: str) -> dict[str, str]:
    response = api.post("/api/v1/auth/login", json={"identifier": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


# ---------- Reference numbers ----------


def test_reference_numbers_are_sequential_per_year(db: Session) -> None:
    assert allocate_reference_number(db, 2031) == "BEA-2031-000001"
    assert allocate_reference_number(db, 2031) == "BEA-2031-000002"
    assert allocate_reference_number(db, 2032) == "BEA-2032-000001"


def test_reserved_numbers_are_never_reallocated(db: Session) -> None:
    assert reserve_reference_number(db, 2033, 123) == "BEA-2033-000123"
    assert allocate_reference_number(db, 2033) == "BEA-2033-000124"
    reserve_reference_number(db, 2033, 5)  # a lower reservation never moves the counter back
    assert allocate_reference_number(db, 2033) == "BEA-2033-000125"


# ---------- Hazard types ----------


def test_hazard_types_are_listed_in_order(api: TestClient) -> None:
    codes = [h["code"] for h in api.get("/api/v1/hazard-types").json()]
    assert codes[:2] == ["flood", "landslide"]
    assert codes[-1] == "other"
    assert len(codes) == 9


# ---------- Resident dashboard ----------


def test_dashboard_counts_and_recent_reports_are_the_residents_own(
    api: TestClient, db: Session
) -> None:
    leona = make_user(db, email="leona@example.com")
    other = make_user(db, email="other@example.com")
    now = datetime.now(UTC)
    for i, status in enumerate(
        [S.SUBMITTED, S.UNDER_VERIFICATION, S.NEEDS_CLARIFICATION, S.RESOLVED]
    ):
        make_report(db, leona, status=status, submitted_at=now - timedelta(days=i))
    make_report(db, other, status=S.VERIFIED)

    body = api.get(
        "/api/v1/me/dashboard", headers=resident_headers(api, "leona@example.com")
    ).json()

    assert body["counts"] == {
        "total": 4,
        "submitted": 1,
        "under_verification": 1,
        "needs_clarification": 1,
        "verified": 0,
        "resolved": 1,
    }
    recent = body["recent_reports"]
    assert len(recent) == 3
    assert [r["status"] for r in recent] == [
        "submitted",
        "under_verification",
        "needs_clarification",
    ]
    assert recent[0]["hazard_type"]["name"] == "Flood"
    assert recent[0]["barangay"]["name"] == "Mantalongon"


def test_dashboard_for_a_new_resident_is_empty(api: TestClient, db: Session) -> None:
    make_user(db, email="new@example.com")
    body = api.get("/api/v1/me/dashboard", headers=resident_headers(api, "new@example.com")).json()
    assert body["counts"]["total"] == 0
    assert body["recent_reports"] == []


def test_my_reports_never_include_other_residents(api: TestClient, db: Session) -> None:
    leona = make_user(db, email="leona@example.com")
    other = make_user(db, email="other@example.com")
    mine = {make_report(db, leona).reference_no for _ in range(3)}
    theirs = make_report(db, other).reference_no

    body = api.get("/api/v1/me/reports", headers=resident_headers(api, "leona@example.com")).json()
    returned = {r["reference_no"] for r in body["items"]}
    assert returned == mine
    assert theirs not in returned
    assert body["total"] == 3


def test_my_reports_pagination(api: TestClient, db: Session) -> None:
    leona = make_user(db, email="leona@example.com")
    for _ in range(5):
        make_report(db, leona)
    headers = resident_headers(api, "leona@example.com")
    page = api.get("/api/v1/me/reports?limit=2&offset=4", headers=headers).json()
    assert page["total"] == 5
    assert len(page["items"]) == 1
    assert api.get("/api/v1/me/reports?limit=500", headers=headers).status_code == 422


def test_resident_endpoints_reject_staff_and_anonymous(api: TestClient, db: Session) -> None:
    make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")
    staff = api.post(
        "/api/v1/staff/auth/login",
        json={"identifier": "officer@example.gov.ph", "password": PASSWORD},
    ).json()["access_token"]
    for path in ("/api/v1/me/dashboard", "/api/v1/me/reports"):
        assert api.get(path).status_code == 401
        assert api.get(path, headers={"Authorization": f"Bearer {staff}"}).status_code == 401


# ---------- Demo data ----------


def test_seeded_demo_report_matches_the_specification(db: Session) -> None:
    seed_demo(db)
    report = db.scalar(select(Report).where(Report.reference_no == "BEA-2026-000123"))
    assert report.is_demo
    assert report.hazard_type.name == "Landslide"
    assert report.barangay.name == "Mantalongon"
    assert (report.municipality, report.province) == ("Dalaguete", "Cebu")
    assert str(report.incident_date) == "2026-09-28"
    assert report.incident_time.strftime("%I:%M %p") == "04:35 PM"
    assert report.status is S.UNDER_VERIFICATION
    assert report.description.startswith("DEMO DATA")
    assert [h.to_status for h in report.history] == [S.SUBMITTED, S.UNDER_VERIFICATION]
