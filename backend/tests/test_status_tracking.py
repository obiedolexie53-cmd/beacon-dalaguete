import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cli import seed_demo
from app.core.errors import ApiError
from app.models import AuditLog, Notification, User, UserRole
from app.reports.status import change_status
from app.reports.workflow import ReportStatus as S
from tests.factories import PASSWORD, make_report, make_user
from tests.test_report_submission import payload

pytestmark = pytest.mark.db


def auth(api: TestClient, email: str = "leona@example.com") -> dict[str, str]:
    token = api.post("/api/v1/auth/login", json={"identifier": email, "password": PASSWORD}).json()[
        "access_token"
    ]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def resident(db: Session) -> User:
    return make_user(db, email="leona@example.com")


@pytest.fixture
def officer(db: Session) -> User:
    return make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")


# ---------- Report details ----------


def test_report_details_for_the_reporter(api: TestClient, db: Session, resident) -> None:
    headers = auth(api)
    created = api.post(
        "/api/v1/me/reports",
        json=payload(db, latitude="9.841200", longitude="123.487300", location_source="gps"),
        headers=headers,
    ).json()
    detail = api.get(f"/api/v1/me/reports/{created['reference_no']}", headers=headers).json()
    assert detail["status"] == "submitted"
    assert detail["description"].startswith("Rocks and soil")
    assert (detail["municipality"], detail["province"]) == ("Dalaguete", "Cebu")
    assert detail["landmark"] == "Near the chapel"
    assert detail["latitude"] == "9.841200"
    assert detail["timeline"] == [
        {
            "status": "submitted",
            "changed_at": detail["timeline"][0]["changed_at"],
            "by": "you",
            "note": None,
        }
    ]
    assert detail["media"] == []
    assert detail["evidence_open"] is True


def test_other_residents_get_not_found(api: TestClient, db: Session, resident) -> None:
    report = make_report(db, resident)
    make_user(db, email="other@example.com")
    response = api.get(
        f"/api/v1/me/reports/{report.reference_no}", headers=auth(api, "other@example.com")
    )
    assert response.status_code == 404
    unknown = api.get("/api/v1/me/reports/BEA-2026-999999", headers=auth(api))
    assert unknown.json() == response.json()


# ---------- Status changes ----------


def test_only_staff_can_change_status(db: Session, resident) -> None:
    report = make_report(db, resident)
    with pytest.raises(ApiError) as error:
        change_status(db, report, S.UNDER_VERIFICATION, resident)
    assert error.value.status_code == 403


def test_status_follows_the_workflow(db: Session, resident, officer) -> None:
    report = make_report(db, resident)
    with pytest.raises(ApiError) as error:
        change_status(db, report, S.VERIFIED, officer)
    assert error.value.code == "invalid_transition"
    assert report.status is S.SUBMITTED


def test_needs_clarification_requires_a_note(db: Session, resident, officer) -> None:
    report = make_report(db, resident)
    with pytest.raises(ApiError) as error:
        change_status(db, report, S.NEEDS_CLARIFICATION, officer, note="  ")
    assert "note" in error.value.fields


def test_full_workflow_is_recorded_and_notified(
    api: TestClient, db: Session, resident, officer
) -> None:
    report = make_report(db, resident)
    change_status(db, report, S.UNDER_VERIFICATION, officer)
    change_status(
        db, report, S.NEEDS_CLARIFICATION, officer, note="Please add a photo of the road."
    )
    change_status(db, report, S.UNDER_VERIFICATION, officer)
    change_status(db, report, S.VERIFIED, officer, note="Confirmed by barangay.")
    change_status(db, report, S.RESOLVED, officer, note="Road cleared.")

    assert report.verified_by_id == officer.id and report.verified_at is not None
    assert report.resolved_by_id == officer.id and report.resolution_notes == "Road cleared."
    assert (
        len(db.scalars(select(AuditLog).where(AuditLog.action == "report.status_changed")).all())
        == 5
    )

    headers = auth(api)
    detail = api.get(f"/api/v1/me/reports/{report.reference_no}", headers=headers).json()
    assert [(t["status"], t["by"]) for t in detail["timeline"]][1:] == [
        ("under_verification", "mdrrmo"),
        ("needs_clarification", "mdrrmo"),
        ("under_verification", "mdrrmo"),
        ("verified", "mdrrmo"),
        ("resolved", "mdrrmo"),
    ]
    assert detail["timeline"][2]["note"] == "Please add a photo of the road."
    assert detail["evidence_open"] is False

    notifications = api.get("/api/v1/me/notifications", headers=headers).json()
    titles = [n["title"] for n in notifications["items"]]
    assert titles[0] == "Report resolved"
    assert "More information needed" in titles
    clarification = next(
        n for n in notifications["items"] if n["title"] == "More information needed"
    )
    assert 'Note from MDRRMO: "Please add a photo of the road."' in clarification["body"]
    assert clarification["report_reference_no"] == report.reference_no
    assert notifications["unread"] == 5


# ---------- Notifications ----------


def test_submission_creates_a_notification(api: TestClient, db: Session, resident) -> None:
    headers = auth(api)
    ref = api.post("/api/v1/me/reports", json=payload(db), headers=headers).json()["reference_no"]
    body = api.get("/api/v1/me/notifications", headers=headers).json()
    assert body["unread"] == 1
    assert body["items"][0]["title"] == "Report received"
    assert ref in body["items"][0]["body"]


def test_notifications_are_private_and_can_be_marked_read(
    api: TestClient, db: Session, resident, officer
) -> None:
    other = make_user(db, email="other@example.com")
    mine = make_report(db, resident)
    theirs = make_report(db, other)
    change_status(db, mine, S.UNDER_VERIFICATION, officer)
    change_status(db, theirs, S.UNDER_VERIFICATION, officer)

    headers = auth(api)
    items = api.get("/api/v1/me/notifications", headers=headers).json()["items"]
    assert [n["report_reference_no"] for n in items] == [mine.reference_no]

    other_notification = db.scalar(select(Notification).where(Notification.user_id == other.id))
    api.post(f"/api/v1/me/notifications/{other_notification.id}/read", headers=headers)
    db.refresh(other_notification)
    assert other_notification.read_at is None  # cannot touch someone else's

    api.post(f"/api/v1/me/notifications/{items[0]['id']}/read", headers=headers)
    assert api.get("/api/v1/me/notifications/unread-count", headers=headers).json() == {"unread": 0}

    change_status(db, mine, S.VERIFIED, officer)
    assert api.get("/api/v1/me/notifications/unread-count", headers=headers).json() == {"unread": 1}
    assert api.post("/api/v1/me/notifications/read-all", headers=headers).status_code == 204
    assert api.get("/api/v1/me/notifications/unread-count", headers=headers).json() == {"unread": 0}


def test_notifications_require_a_resident(api: TestClient) -> None:
    assert api.get("/api/v1/me/notifications").status_code == 401


def test_demo_seed_leaves_one_unread_notification(db: Session) -> None:
    seed_demo(db)
    leona = db.scalar(select(User).where(User.email == "leona.legaspi@demo.beacon.local"))
    unread = db.scalars(
        select(Notification).where(Notification.user_id == leona.id, Notification.read_at.is_(None))
    ).all()
    assert [n.title for n in unread] == ["Your report is being verified"]
