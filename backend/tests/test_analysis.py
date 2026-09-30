import csv
import io
from datetime import date, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.imports.records import RecordRow
from app.imports.service import save_records
from app.models import AuditLog, UserRole
from app.reports.workflow import ReportStatus as S
from tests.factories import PASSWORD, barangay_id, make_report, make_user

pytestmark = pytest.mark.db

URL = "/api/v1/staff/analysis/incidents"


@pytest.fixture
def staff(api: TestClient, db: Session) -> dict[str, str]:
    make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")
    token = api.post(
        "/api/v1/staff/auth/login",
        json={"identifier": "officer@example.gov.ph", "password": PASSWORD},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _row(db, n, day, hazard="landslide", place="Mantalongon", at=None, **kw) -> RecordRow:
    values = dict(
        row_number=n,
        incident_date=day,
        incident_time=at,
        hazard_code=hazard,
        other_hazard_text=None,
        barangay_id=barangay_id(db, place),
        description="Record",
        landmark=None,
        latitude=None,
        longitude=None,
        status=S.RESOLVED,
        external_ref=None,
    )
    values.update(kw)
    return RecordRow(**values)


@pytest.fixture
def dataset(db: Session):
    """Four imported records (one DEMO batch) and resident reports in several states."""
    save_records(
        db,
        [
            _row(db, 2, date(2025, 9, 3), at=time(16, 30)),  # Wednesday
            _row(db, 3, date(2025, 10, 11), at=time(16, 5)),
            _row(db, 4, date(2025, 12, 1), hazard="flood", place="Poblacion"),
        ],
        filename="records.csv",
        imported_by_id=None,
    )
    save_records(
        db,
        [_row(db, 2, date(2025, 9, 20), hazard="fire")],
        filename="demo",
        imported_by_id=None,
        is_demo=True,
    )
    leona = make_user(db, email="leona@example.com")
    make_report(db, leona, status=S.VERIFIED)  # 2026-09-01, Mantalongon, flood
    make_report(db, leona)  # submitted: not MDRRMO-confirmed
    db.commit()


def test_counts_confirmed_records_by_default(api: TestClient, staff, dataset) -> None:
    body = api.get(URL, headers=staff).json()
    assert body["filters"]["scope"] == "confirmed"
    assert body["dataset"] == {
        "total": 5,
        "from_app": 1,
        "imported": 4,
        "demo": 1,
        "with_coordinates": 0,
        "with_time": 2,
        "first_incident": "2025-09-03",
        "last_incident": "2026-09-01",
    }
    assert [(h["code"], h["count"], h["share"]) for h in body["by_hazard"]] == [
        ("flood", 2, 0.4),
        ("landslide", 2, 0.4),
        ("fire", 1, 0.2),
    ]
    top = body["by_barangay"][0]
    assert (top["name"], top["count"], top["top_hazard"], top["top_hazard_count"]) == (
        "Mantalongon",
        4,
        "landslide",
        2,
    )
    # Every month from the first record to the last, including empty ones.
    months = body["by_month"]
    assert months[0] == {"month": "2025-09", "count": 2}
    assert months[-1] == {"month": "2026-09", "count": 1}
    assert len(months) == 13
    assert body["by_month_of_year"][8] == {"key": 9, "count": 3}
    assert body["by_hour"][16] == {"key": 16, "count": 2}
    assert body["unknown_time"] == 3
    assert body["by_weekday"][2] == {"key": 3, "count": 1}
    assert {"hazard": "fire", "month_of_year": 9, "count": 1} in body["hazard_by_month_of_year"]


def test_filters(api: TestClient, staff, dataset) -> None:
    def total(**params) -> int:
        return api.get(URL, params=params, headers=staff).json()["dataset"]["total"]

    assert total(scope="all") == 6
    assert total(include_demo="false") == 4
    assert total(source="resident") == 1
    assert total(source="import", hazard="landslide") == 2
    assert total(date_from="2025-10-01", date_to="2025-12-31") == 2
    body = api.get(
        URL, params={"date_from": "2025-01-01", "date_to": "2025-03-31"}, headers=staff
    ).json()
    assert body["dataset"]["total"] == 0
    assert [m["month"] for m in body["by_month"]] == ["2025-01", "2025-02", "2025-03"]
    bad = api.get(URL, params={"date_from": "2026-01-01", "date_to": "2025-01-01"}, headers=staff)
    assert bad.status_code == 422


def test_export_has_no_personal_details_and_is_audited(
    api: TestClient, db: Session, staff, dataset
) -> None:
    response = api.get(f"{URL}/export", params={"source": "resident"}, headers=staff)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    rows = list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))
    assert len(rows) == 1
    assert rows[0]["status"] == "verified" and rows[0]["source"] == "resident"
    text = response.text
    assert "leona" not in text.lower() and "Test incident" not in text
    entry = db.scalar(select(AuditLog).where(AuditLog.action == "reports.exported"))
    assert entry is not None and entry.details["rows"] == 1


def test_export_neutralises_spreadsheet_formulas(api: TestClient, db: Session, staff) -> None:
    save_records(
        db,
        [_row(db, 2, date(2025, 9, 3), landmark="=HYPERLINK(1)", external_ref="+1")],
        filename="x.csv",
        imported_by_id=None,
    )
    db.commit()
    rows = list(
        csv.DictReader(
            io.StringIO(api.get(f"{URL}/export", headers=staff).content.decode("utf-8-sig"))
        )
    )
    assert rows[0]["landmark"] == "'=HYPERLINK(1)"
    assert rows[0]["external_ref"] == "'+1"


def test_analysis_is_staff_only(api: TestClient, db: Session) -> None:
    assert api.get(URL).status_code == 401
    make_user(db, email="leona@example.com")
    token = api.post(
        "/api/v1/auth/login", json={"identifier": "leona@example.com", "password": PASSWORD}
    ).json()["access_token"]
    resident = {"Authorization": f"Bearer {token}"}
    assert api.get(URL, headers=resident).status_code in (401, 403)
    assert api.get(f"{URL}/export", headers=resident).status_code in (401, 403)
