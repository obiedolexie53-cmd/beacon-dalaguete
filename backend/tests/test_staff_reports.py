from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog, HazardType, Notification, User, UserRole
from app.reports.workflow import ReportStatus as S
from tests.factories import PASSWORD, barangay_id, make_report, make_user

pytestmark = pytest.mark.db


@pytest.fixture
def officer(db: Session) -> User:
    user = make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")
    user.full_name = "Juan Dela Cruz"
    db.commit()
    return user


@pytest.fixture
def staff(api: TestClient, officer) -> dict[str, str]:
    token = api.post(
        "/api/v1/staff/auth/login",
        json={"identifier": "officer@example.gov.ph", "password": PASSWORD},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def leona(db: Session) -> User:
    user = make_user(db, email="leona@example.com", phone="+639171234567")
    user.full_name = "Leona Legaspi"
    user.barangay_id = barangay_id(db, "Mantalongon")
    db.commit()
    return user


def refs(response) -> list[str]:
    return [r["reference_no"] for r in response.json()["items"]]


# ---------- List, search and filters ----------


def test_filters_and_search(api: TestClient, db: Session, staff, leona) -> None:
    other = make_user(db, email="pedro@example.com")
    other.full_name = "Pedro Penduko"
    db.commit()
    flood = make_report(db, leona, status=S.SUBMITTED)
    landslide = make_report(db, other, status=S.VERIFIED, hazard_code="landslide")
    landslide.description = "Boulders fell near the chapel"
    landslide.barangay_id = barangay_id(db, "Poblacion")
    landslide.incident_date = date(2026, 8, 1)
    db.commit()

    base = "/api/v1/staff/reports"
    assert set(refs(api.get(base, headers=staff))) == {flood.reference_no, landslide.reference_no}
    assert refs(api.get(f"{base}?status=verified", headers=staff)) == [landslide.reference_no]
    assert refs(api.get(f"{base}?hazard=flood", headers=staff)) == [flood.reference_no]
    poblacion = barangay_id(db, "Poblacion")
    assert refs(api.get(f"{base}?barangay_id={poblacion}", headers=staff)) == [
        landslide.reference_no
    ]
    assert refs(api.get(f"{base}?date_to=2026-08-31", headers=staff)) == [landslide.reference_no]
    assert refs(api.get(f"{base}?date_from=2026-09-01", headers=staff)) == [flood.reference_no]
    assert refs(api.get(f"{base}?q=chapel", headers=staff)) == [landslide.reference_no]
    assert refs(api.get(f"{base}?q=penduko", headers=staff)) == [landslide.reference_no]
    assert refs(api.get(f"{base}?q={flood.reference_no}", headers=staff)) == [flood.reference_no]
    assert refs(api.get(f"{base}?q=100%25", headers=staff)) == []  # % is matched literally


def test_pagination_and_demo_exclusion(api: TestClient, db: Session, staff, leona) -> None:
    for _ in range(5):
        make_report(db, leona)
    demo = make_report(db, leona)
    demo.is_demo = True
    db.commit()
    page = api.get("/api/v1/staff/reports?limit=2&offset=2", headers=staff).json()
    assert (page["total"], len(page["items"]), page["offset"]) == (6, 2, 2)
    real = api.get("/api/v1/staff/reports?include_demo=false", headers=staff).json()
    assert real["total"] == 5
    assert demo.reference_no not in [r["reference_no"] for r in real["items"]]


# ---------- Report review ----------


def test_review_shows_reporter_and_is_audited(
    api: TestClient, db: Session, staff, leona, officer
) -> None:
    report = make_report(db, leona)
    body = api.get(f"/api/v1/staff/reports/{report.reference_no}", headers=staff).json()
    assert body["reporter"] == {
        "id": str(leona.id),
        "full_name": "Leona Legaspi",
        "email": "leona@example.com",
        "phone": "+639171234567",
        "barangay": {"id": barangay_id(db, "Mantalongon"), "name": "Mantalongon"},
    }
    assert body["timeline"][0]["by_role"] == "resident"
    assert body["allowed_actions"] == ["under_verification", "needs_clarification"]
    viewed = db.scalars(select(AuditLog).where(AuditLog.action == "report.viewed")).all()
    assert [(a.actor_id, a.entity_id) for a in viewed] == [(officer.id, report.reference_no)]


def test_unknown_report(api: TestClient, staff) -> None:
    response = api.get("/api/v1/staff/reports/BEA-2026-999999", headers=staff)
    assert response.status_code == 404


# ---------- Status updates ----------


def post_status(api, headers, ref, status, from_status, note=None):
    return api.post(
        f"/api/v1/staff/reports/{ref}/status",
        json={"status": status, "from_status": from_status, "note": note},
        headers=headers,
    )


def test_verification_workflow(api: TestClient, db: Session, staff, leona) -> None:
    ref = make_report(db, leona).reference_no
    step = post_status(api, staff, ref, "under_verification", "submitted")
    assert step.status_code == 200
    assert step.json()["allowed_actions"] == ["needs_clarification", "verified"]

    verified = post_status(api, staff, ref, "verified", "under_verification", "Confirmed on site")
    body = verified.json()
    assert body["status"] == "verified"
    assert (body["verified_by"], body["verification_notes"]) == (
        "Juan Dela Cruz",
        "Confirmed on site",
    )
    assert body["timeline"][-1] == {
        "status": "verified",
        "changed_at": body["timeline"][-1]["changed_at"],
        "by_role": "mdrrmo",
        "actor_name": "Juan Dela Cruz",
        "note": "Confirmed on site",
    }

    resolved = post_status(api, staff, ref, "resolved", "verified").json()
    assert resolved["resolved_by"] == "Juan Dela Cruz"
    assert resolved["allowed_actions"] == []
    assert db.scalar(
        select(Notification).where(
            Notification.user_id == leona.id, Notification.kind == "status_resolved"
        )
    )


def test_submitted_reports_cannot_be_verified_directly(
    api: TestClient, db: Session, staff, leona
) -> None:
    ref = make_report(db, leona).reference_no
    response = post_status(api, staff, ref, "verified", "submitted")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "invalid_transition"


def test_clarification_needs_a_note(api: TestClient, db: Session, staff, leona) -> None:
    ref = make_report(db, leona).reference_no
    response = post_status(api, staff, ref, "needs_clarification", "submitted")
    assert response.status_code == 422
    assert "note" in response.json()["error"]["fields"]


def test_concurrent_updates_are_detected(api: TestClient, db: Session, staff, leona) -> None:
    ref = make_report(db, leona).reference_no
    assert post_status(api, staff, ref, "under_verification", "submitted").status_code == 200
    # A second officer still looking at the old "submitted" screen:
    stale = post_status(api, staff, ref, "needs_clarification", "submitted", "Which sitio?")
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "status_changed"
    assert "Under Verification" in stale.json()["error"]["message"]


def test_residents_cannot_use_staff_report_endpoints(api: TestClient, db: Session, leona) -> None:
    ref = make_report(db, leona).reference_no
    token = api.post(
        "/api/v1/auth/login", json={"identifier": "leona@example.com", "password": PASSWORD}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert api.get("/api/v1/staff/reports", headers=headers).status_code == 401
    assert api.get(f"/api/v1/staff/reports/{ref}", headers=headers).status_code == 401
    assert post_status(api, headers, ref, "under_verification", "submitted").status_code == 401


def test_hazard_filter_accepts_new_hazard_types(api: TestClient, db: Session, staff, leona) -> None:
    db.add(HazardType(code="sinkhole", name="Sinkhole", sort_order=99))
    db.commit()
    report = make_report(db, leona, hazard_code="sinkhole")
    assert refs(api.get("/api/v1/staff/reports?hazard=sinkhole", headers=staff)) == [
        report.reference_no
    ]
