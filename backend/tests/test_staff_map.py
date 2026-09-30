from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import UserRole
from app.reports.workflow import ReportStatus as S
from app.staff import reports as staff_reports
from tests.factories import PASSWORD, make_report, make_user

pytestmark = pytest.mark.db


@pytest.fixture
def staff(api: TestClient, db: Session) -> dict[str, str]:
    make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")
    token = api.post(
        "/api/v1/staff/auth/login",
        json={"identifier": "officer@example.gov.ph", "password": PASSWORD},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def pinned(db, reporter, lat="9.841200", lng="123.487300", **kwargs):
    report = make_report(db, reporter, **kwargs)
    report.latitude, report.longitude = Decimal(lat), Decimal(lng)
    db.commit()
    return report


def test_map_returns_located_reports_without_personal_details(
    api: TestClient, db: Session, staff
) -> None:
    leona = make_user(db, email="leona@example.com")
    located = pinned(db, leona)
    make_report(db, leona)  # landmark only, no coordinates
    body = api.get("/api/v1/staff/map/reports", headers=staff).json()
    assert [p["reference_no"] for p in body["points"]] == [located.reference_no]
    point = body["points"][0]
    assert (point["latitude"], point["longitude"]) == ("9.841200", "123.487300")
    assert point["hazard_type"]["code"] == "flood"
    assert "reporter" not in point and "description" not in point
    assert body["without_location"] == 1
    assert body["truncated"] is False


def test_map_filters(api: TestClient, db: Session, staff) -> None:
    leona = make_user(db, email="leona@example.com")
    flood = pinned(db, leona, status=S.VERIFIED)
    landslide = pinned(db, leona, hazard_code="landslide")
    demo = pinned(db, leona)
    demo.is_demo = True
    db.commit()

    def refs(query: str) -> set[str]:
        body = api.get(f"/api/v1/staff/map/reports?{query}", headers=staff).json()
        return {p["reference_no"] for p in body["points"]}

    assert refs("status=verified") == {flood.reference_no}
    assert refs("hazard=landslide") == {landslide.reference_no}
    assert demo.reference_no not in refs("include_demo=false")
    assert refs("date_from=2030-01-01") == set()


def test_map_is_capped(
    api: TestClient, db: Session, staff, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(staff_reports, "MAP_POINT_LIMIT", 2)
    leona = make_user(db, email="leona@example.com")
    for _ in range(3):
        pinned(db, leona)
    body = api.get("/api/v1/staff/map/reports", headers=staff).json()
    assert len(body["points"]) == 2
    assert body["truncated"] is True


def test_map_is_staff_only(api: TestClient, db: Session) -> None:
    make_user(db, email="leona@example.com")
    token = api.post(
        "/api/v1/auth/login", json={"identifier": "leona@example.com", "password": PASSWORD}
    ).json()["access_token"]
    assert api.get("/api/v1/staff/map/reports").status_code == 401
    assert (
        api.get(
            "/api/v1/staff/map/reports", headers={"Authorization": f"Bearer {token}"}
        ).status_code
        == 401
    )
