from collections import Counter
from datetime import date, time
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.cli import (
    CliError,
    ImportFailed,
    delete_import,
    import_records,
    seed_demo_history,
)
from app.core.config import get_settings
from app.imports.records import Lookups, read_records
from app.models import AuditLog, ImportBatch, Notification, Report, ReportSource, UserRole
from app.reports.workflow import ReportStatus
from seeds.barangays import DALAGUETE_BARANGAYS
from seeds.demo_history import generate_demo_history
from tests.factories import PASSWORD, make_report, make_user

LOOKUPS = Lookups(
    {"flood": "Flood", "landslide": "Landslide", "other": "Other Hazard"},
    {"Mantalongon": 1, "Poblacion": 2},
)
HEADER = "date,time,hazard,other_hazard,barangay,description,latitude,longitude,status,external_ref"
TEMPLATE = Path(__file__).parents[2] / "docs" / "templates" / "mdrrmo_records_template.csv"


def test_reads_valid_rows_in_accepted_formats() -> None:
    text = (
        "﻿" + HEADER + "\n"
        "2025-09-28,16:35,Landslide,,mantalongon,Road blocked,9.7812,123.4765,Verified,R-1\n"
        "09/30/2025,4:10 PM,FLOOD,,Poblacion,  Flooded   street ,,,,\n"
        ",,,,,,,,,\n"
        "2025-10-02,,Other Hazard,Sinkhole,Poblacion,Sinkhole,,,resolved,\n"
    )
    rows, errors = read_records(text, LOOKUPS)
    assert errors == []
    assert [r.row_number for r in rows] == [2, 3, 5]
    first, second, third = rows
    assert (first.hazard_code, first.barangay_id, first.status) == ("landslide", 1, "verified")
    assert (first.latitude, first.longitude) == (Decimal("9.781200"), Decimal("123.476500"))
    assert first.incident_time == time(16, 35)
    assert (second.incident_date, second.incident_time) == (date(2025, 9, 30), time(16, 10))
    assert second.description == "Flooded street"
    assert second.status is ReportStatus.RESOLVED  # default for MDRRMO records
    assert third.other_hazard_text == "Sinkhole"


def test_reports_every_problem_by_row_and_column() -> None:
    text = (
        HEADER + "\n"
        "2999-01-01,25:00,Tsunami,,Atlantis,,9.7,,Submitted,A\n"
        "2025-01-01,,flood,,Poblacion,x,1,2,,A\n"
        "2025-01-01,,other,,Poblacion,x,,,,\n"
    )
    rows, errors = read_records(text, LOOKUPS)
    assert rows == []
    found = {(e.row_number, e.column) for e in errors}
    assert found == {
        (2, "date"),
        (2, "time"),
        (2, "hazard"),
        (2, "barangay"),
        (2, "description"),
        (2, "latitude"),
        (2, "status"),
        (3, "latitude"),
        (3, "external_ref"),
        (4, "other_hazard"),
    }
    assert str(errors[0]).startswith("Row 2, date:")


def test_rejects_bad_headers() -> None:
    _, errors = read_records("date,hazard,description,colour\n", LOOKUPS)
    messages = " ".join(e.message for e in errors)
    assert "Missing required column(s): barangay" in messages
    assert "Unknown column(s): colour" in messages
    _, errors = read_records(HEADER + "\n", LOOKUPS)
    assert errors[0].message == "The file has no records"


def test_template_file_is_valid() -> None:
    rows, errors = read_records(TEMPLATE.read_text(encoding="utf-8-sig"), _real_lookups())
    assert errors == []
    assert len(rows) == 3


def _real_lookups() -> Lookups:
    return Lookups(
        {"landslide": "Landslide", "flood": "Flood", "other": "Other Hazard"},
        {name: i for i, name in enumerate(DALAGUETE_BARANGAYS)},
    )


def test_demo_history_is_deterministic_and_seasonal() -> None:
    names = DALAGUETE_BARANGAYS
    lookups = Lookups({}, {name: i for i, name in enumerate(names)})
    end = date(2026, 8, 31)
    first = generate_demo_history(lookups, names, end=end, months=24, seed=1)
    again = generate_demo_history(lookups, names, end=end, months=24, seed=1)
    assert first == again
    assert 120 <= len(first) <= 320
    assert all(r.description.startswith("DEMO DATA") for r in first)
    assert min(r.incident_date for r in first) >= date(2024, 9, 1)
    assert max(r.incident_date for r in first) <= end
    months = Counter(r.incident_date.month for r in first)
    rainy = sum(months[m] for m in range(6, 13)) / 7
    dry = sum(months[m] for m in range(1, 6)) / 5
    assert rainy > 2 * dry


# --- Database ---------------------------------------------------------------------------


@pytest.fixture
def officer(db: Session):
    return make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")


def _csv(tmp_path: Path, body: str) -> Path:
    path = tmp_path / "records.csv"
    path.write_text(HEADER + "\n" + body, encoding="utf-8")
    return path


@pytest.mark.db
def test_import_saves_records_with_imp_numbers(db: Session, officer, tmp_path: Path) -> None:
    path = _csv(
        tmp_path,
        "2025-10-02,,Flood,,Poblacion,Later record,,,,R-2\n"
        "2025-09-28,16:35,Landslide,,Mantalongon,Earlier record,9.7812,123.4765,Verified,R-1\n",
    )
    assert import_records(db, path, by_email=officer.email, dry_run=True) == 2
    assert db.scalar(select(func.count()).select_from(ImportBatch)) == 0

    batch = import_records(db, path, by_email=officer.email)
    reports = db.scalars(
        select(Report).where(Report.import_batch_id == batch.id).order_by(Report.reference_no)
    ).all()
    # Numbered in date order, on the import counter.
    assert [(r.reference_no, r.external_ref) for r in reports] == [
        ("IMP-2025-000001", "R-1"),
        ("IMP-2025-000002", "R-2"),
    ]
    earlier = reports[0]
    assert earlier.source is ReportSource.IMPORT and earlier.reporter_id is None
    assert earlier.status is ReportStatus.VERIFIED and not earlier.is_demo
    assert earlier.history[0].note == "Imported from MDRRMO records (records.csv)."
    assert earlier.history[0].changed_by_id == officer.id
    assert db.scalar(select(func.count()).select_from(Notification)) == 0
    assert db.scalar(select(AuditLog).where(AuditLog.action == "records.imported"))

    # The same file cannot be imported twice.
    with pytest.raises(ImportFailed) as failed:
        import_records(db, path, by_email=officer.email)
    assert "already imported" in str(failed.value.errors[0])


@pytest.mark.db
def test_import_is_all_or_nothing(db: Session, officer, tmp_path: Path) -> None:
    path = _csv(
        tmp_path, "2025-09-28,,Flood,,Poblacion,Fine,,,,\n2025-09-28,,Flood,,Nowhere,Bad,,,,\n"
    )
    with pytest.raises(ImportFailed):
        import_records(db, path, by_email=officer.email)
    assert db.scalar(select(func.count()).select_from(Report)) == 0


@pytest.mark.db
def test_import_requires_active_staff(db: Session, tmp_path: Path) -> None:
    resident = make_user(db, email="leona@example.com")
    path = _csv(tmp_path, "2025-09-28,,Flood,,Poblacion,Fine,,,,\n")
    with pytest.raises(CliError, match="No active staff"):
        import_records(db, path, by_email=resident.email)


@pytest.mark.db
def test_delete_import_removes_its_records_only(db: Session, officer, tmp_path: Path) -> None:
    resident_report = make_report(db, make_user(db, email="leona@example.com"))
    path = _csv(tmp_path, "2025-09-28,,Flood,,Poblacion,Fine,,,,\n")
    batch = import_records(db, path, by_email=officer.email)
    assert delete_import(db, str(batch.id)) == 1
    assert db.scalars(select(Report.reference_no)).all() == [resident_report.reference_no]
    with pytest.raises(CliError):
        delete_import(db, str(batch.id))
    with pytest.raises(CliError):
        delete_import(db, "not-a-uuid")


@pytest.mark.db
def test_seed_demo_history(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    batch = seed_demo_history(db, months=12, end=date(2026, 8, 31))
    assert batch is not None and batch.is_demo and batch.row_count > 30
    demo = db.scalars(select(Report).where(Report.import_batch_id == batch.id)).all()
    assert all(r.is_demo and r.reference_no.startswith("IMP-") for r in demo)
    assert seed_demo_history(db, months=12, end=date(2026, 8, 31)) is None
    again = seed_demo_history(db, months=12, end=date(2026, 8, 31), replace=True)
    assert again is not None and again.row_count == batch.row_count
    assert db.scalar(select(func.count()).select_from(ImportBatch)) == 1

    monkeypatch.setattr(get_settings(), "environment", "production")
    with pytest.raises(CliError, match="production"):
        seed_demo_history(db, replace=True)


@pytest.mark.db
def test_staff_can_review_imported_records(
    api: TestClient, db: Session, officer, tmp_path: Path
) -> None:
    path = _csv(tmp_path, "2025-09-28,,Flood,,Poblacion,Market flooded,,,Verified,MD-7\n")
    import_records(db, path, by_email=officer.email)
    headers = {
        "Authorization": "Bearer "
        + api.post(
            "/api/v1/staff/auth/login",
            json={"identifier": officer.email, "password": PASSWORD},
        ).json()["access_token"]
    }
    # Found by its original record number; the search does not require a reporter.
    page = api.get("/api/v1/staff/reports", params={"q": "MD-7"}, headers=headers).json()
    assert [r["source"] for r in page["items"]] == ["import"]
    detail = api.get("/api/v1/staff/reports/IMP-2025-000001", headers=headers).json()
    assert detail["reporter"] is None
    assert detail["external_ref"] == "MD-7"
    assert detail["import_filename"] == "records.csv"
    assert detail["timeline"][0]["by_role"] == "mdrrmo"
    # Status changes still work, and nobody is notified.
    moved = api.post(
        "/api/v1/staff/reports/IMP-2025-000001/status",
        json={"status": "resolved", "from_status": "verified"},
        headers=headers,
    )
    assert moved.status_code == 200, moved.text
    assert db.scalar(select(func.count()).select_from(Notification)) == 0
