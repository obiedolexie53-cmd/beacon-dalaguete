"""Creating reports."""

from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit.service import record
from app.core.errors import ApiError
from app.models import Barangay, HazardType, Report, ReportStatusHistory, User
from app.notifications.service import notify_submitted
from app.reports.reference import allocate_reference_number
from app.reports.schemas import ReportCreate
from app.reports.validation import local_now
from app.reports.workflow import INITIAL_STATUS

MAX_REPORTS_PER_HOUR = 10
OTHER_HAZARD_CODE = "other"


def _field_error(field: str, message: str) -> ApiError:
    return ApiError(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "validation_error",
        "Please check the highlighted fields.",
        {field: message},
    )


def find_existing_submission(db: Session, reporter: User, data: ReportCreate) -> Report | None:
    return db.scalar(
        select(Report).where(
            Report.reporter_id == reporter.id,
            Report.client_request_id == data.client_request_id,
        )
    )


def create_report(db: Session, reporter: User, data: ReportCreate, ip: str | None) -> Report:
    """Save a resident's report as Submitted. Nothing here can mark it verified."""
    hazard = db.get(HazardType, data.hazard_type_id)
    if hazard is None or not hazard.is_active:
        raise _field_error("hazard_type_id", "Select a hazard type")
    other_text = data.other_hazard_text if hazard.code == OTHER_HAZARD_CODE else None
    if hazard.code == OTHER_HAZARD_CODE and (not other_text or len(other_text) < 3):
        raise _field_error("other_hazard_text", "Describe the hazard in a few words")
    if db.get(Barangay, data.barangay_id) is None:
        raise _field_error("barangay_id", "Select the barangay where the incident happened")

    recent = db.scalar(
        select(func.count())
        .select_from(Report)
        .where(
            Report.reporter_id == reporter.id,
            Report.submitted_at > datetime.now(UTC) - timedelta(hours=1),
        )
    )
    if recent >= MAX_REPORTS_PER_HOUR:
        raise ApiError(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "too_many_reports",
            "You have sent many reports in the past hour. Please wait before sending another, "
            "or contact the MDRRMO directly.",
        )

    report = Report(
        reference_no=allocate_reference_number(db, local_now().year),
        reporter_id=reporter.id,
        client_request_id=data.client_request_id,
        hazard_type_id=hazard.id,
        other_hazard_text=other_text,
        description=data.description,
        incident_date=data.incident_date,
        incident_time=data.incident_time,
        barangay_id=data.barangay_id,
        landmark=data.landmark,
        latitude=data.latitude,
        longitude=data.longitude,
        location_accuracy_m=data.location_accuracy_m,
        location_source=data.location_source,
        status=INITIAL_STATUS,
    )
    db.add(report)
    try:
        db.flush()
    except IntegrityError:
        # The same draft was submitted twice at the same moment; keep the first.
        db.rollback()
        existing = find_existing_submission(db, reporter, data)
        if existing is None:
            raise
        return existing
    db.add(
        ReportStatusHistory(
            report_id=report.id,
            from_status=None,
            to_status=INITIAL_STATUS,
            changed_by_id=reporter.id,
        )
    )
    notify_submitted(db, report)
    record(
        db,
        "report.submitted",
        actor_id=reporter.id,
        ip=ip,
        entity="report",
        entity_id=report.reference_no,
    )
    db.commit()
    db.refresh(report)
    return report
