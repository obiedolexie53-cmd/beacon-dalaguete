import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditLog, HazardType, Report, ReportStatusHistory, UserRole
from app.reports.validation import local_now
from tests.factories import PASSWORD, barangay_id, make_user

pytestmark = pytest.mark.db


def hazard_id(db: Session, code: str) -> int:
    return db.scalar(select(HazardType.id).where(HazardType.code == code))


def headers(api: TestClient, email: str = "leona@example.com") -> dict[str, str]:
    token = api.post("/api/v1/auth/login", json={"identifier": email, "password": PASSWORD}).json()[
        "access_token"
    ]
    return {"Authorization": f"Bearer {token}"}


def payload(db: Session, **overrides: object) -> dict[str, object]:
    now = local_now() - timedelta(hours=1)
    body: dict[str, object] = {
        "client_request_id": str(uuid.uuid4()),
        "hazard_type_id": hazard_id(db, "landslide"),
        "description": "Rocks and soil fell onto the road near the chapel.",
        "incident_date": now.date().isoformat(),
        "incident_time": now.strftime("%H:%M"),
        "barangay_id": barangay_id(db),
        "landmark": "  Near   the chapel ",
    }
    body.update(overrides)
    return body


@pytest.fixture
def resident(db: Session):
    return make_user(db, email="leona@example.com")


def test_submitted_report_starts_as_submitted(api: TestClient, db: Session, resident) -> None:
    response = api.post("/api/v1/me/reports", json=payload(db), headers=headers(api))
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "submitted"
    assert body["reference_no"].startswith(f"BEA-{local_now().year}-")
    assert body["hazard_type"]["code"] == "landslide"
    assert body["is_demo"] is False

    report = db.scalar(select(Report).where(Report.reference_no == body["reference_no"]))
    assert report.reporter_id == resident.id
    assert report.landmark == "Near the chapel"
    assert report.verified_at is None and report.verified_by_id is None
    history = db.scalars(
        select(ReportStatusHistory).where(ReportStatusHistory.report_id == report.id)
    ).all()
    assert [(h.from_status, h.to_status.value) for h in history] == [(None, "submitted")]
    assert db.scalar(select(AuditLog).where(AuditLog.action == "report.submitted"))


def test_client_cannot_choose_status_reporter_or_reference(
    api: TestClient, db: Session, resident
) -> None:
    other = make_user(db, email="other@example.com")
    body = payload(
        db,
        status="verified",
        reporter_id=str(other.id),
        reference_no="BEA-2026-999999",
        is_demo=True,
    )
    created = api.post("/api/v1/me/reports", json=body, headers=headers(api)).json()
    assert created["status"] == "submitted"
    assert created["reference_no"] != "BEA-2026-999999"
    assert created["is_demo"] is False
    report = db.scalar(select(Report).where(Report.reference_no == created["reference_no"]))
    assert report.reporter_id == resident.id


def test_retrying_the_same_draft_does_not_duplicate(api: TestClient, db: Session, resident) -> None:
    body = payload(db)
    first = api.post("/api/v1/me/reports", json=body, headers=headers(api))
    retry = api.post("/api/v1/me/reports", json=body, headers=headers(api))
    assert (first.status_code, retry.status_code) == (201, 200)
    assert first.json()["reference_no"] == retry.json()["reference_no"]
    assert db.scalar(select(func.count()).select_from(Report)) == 1


def test_other_hazard_requires_a_description(api: TestClient, db: Session, resident) -> None:
    other = hazard_id(db, "other")
    missing = api.post(
        "/api/v1/me/reports", json=payload(db, hazard_type_id=other), headers=headers(api)
    )
    assert missing.status_code == 422
    assert "other_hazard_text" in missing.json()["error"]["fields"]

    ok = api.post(
        "/api/v1/me/reports",
        json=payload(db, hazard_type_id=other, other_hazard_text="Sinkhole"),
        headers=headers(api),
    )
    assert ok.status_code == 201
    assert ok.json()["other_hazard_text"] == "Sinkhole"


def test_other_hazard_text_is_dropped_for_named_hazards(
    api: TestClient, db: Session, resident
) -> None:
    body = api.post(
        "/api/v1/me/reports", json=payload(db, other_hazard_text="ignored"), headers=headers(api)
    ).json()
    assert body["other_hazard_text"] is None


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"description": "  short  "}, "description"),
        ({"description": "x" * 2001}, "description"),
        ({"incident_date": (local_now() + timedelta(days=2)).date().isoformat()}, "incident_date"),
        (
            {"incident_date": (local_now() - timedelta(days=400)).date().isoformat()},
            "incident_date",
        ),
        ({"hazard_type_id": 999_999}, "hazard_type_id"),
        ({"barangay_id": 999_999}, "barangay_id"),
        ({"client_request_id": "not-a-uuid"}, "client_request_id"),
        ({"latitude": "9.8"}, "request"),
        ({"latitude": "10.3157", "longitude": "123.8854"}, "longitude"),
        ({"landmark": None}, "landmark"),
        ({"landmark": " x "}, "landmark"),
    ],
)
def test_report_validation(
    api: TestClient, db: Session, resident, overrides: dict, field: str
) -> None:
    response = api.post("/api/v1/me/reports", json=payload(db, **overrides), headers=headers(api))
    assert response.status_code == 422
    assert field in response.json()["error"]["fields"]


def test_incident_time_later_today_is_rejected(api: TestClient, db: Session, resident) -> None:
    later = local_now() + timedelta(hours=2)
    if later.date() != local_now().date():
        pytest.skip("near midnight in Manila")
    response = api.post(
        "/api/v1/me/reports",
        json=payload(
            db, incident_date=later.date().isoformat(), incident_time=later.strftime("%H:%M")
        ),
        headers=headers(api),
    )
    assert response.status_code == 422
    assert "incident_time" in response.json()["error"]["fields"]


def test_submissions_are_rate_limited(api: TestClient, db: Session, resident) -> None:
    auth = headers(api)
    for _ in range(10):
        assert api.post("/api/v1/me/reports", json=payload(db), headers=auth).status_code == 201
    blocked = api.post("/api/v1/me/reports", json=payload(db), headers=auth)
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "too_many_reports"


def test_only_residents_can_submit(api: TestClient, db: Session) -> None:
    make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")
    staff = api.post(
        "/api/v1/staff/auth/login",
        json={"identifier": "officer@example.gov.ph", "password": PASSWORD},
    ).json()["access_token"]
    body = payload(db)
    assert api.post("/api/v1/me/reports", json=body).status_code == 401
    assert (
        api.post(
            "/api/v1/me/reports", json=body, headers={"Authorization": f"Bearer {staff}"}
        ).status_code
        == 401
    )


def test_new_report_appears_on_the_dashboard(api: TestClient, db: Session, resident) -> None:
    auth = headers(api)
    created = api.post("/api/v1/me/reports", json=payload(db), headers=auth).json()
    dashboard = api.get("/api/v1/me/dashboard", headers=auth).json()
    assert dashboard["counts"]["submitted"] == 1
    assert dashboard["recent_reports"][0]["reference_no"] == created["reference_no"]


def test_coordinates_without_landmark_are_accepted(api: TestClient, db: Session, resident) -> None:
    body = payload(
        db,
        landmark=None,
        latitude="9.841200",
        longitude="123.487300",
        location_accuracy_m=12,
        location_source="gps",
    )
    response = api.post("/api/v1/me/reports", json=body, headers=headers(api))
    assert response.status_code == 201
    report = db.scalar(select(Report).where(Report.reference_no == response.json()["reference_no"]))
    assert (float(report.latitude), float(report.longitude)) == (9.8412, 123.4873)
    assert report.location_source.value == "gps"
    assert report.location_accuracy_m == 12
