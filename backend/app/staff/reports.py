"""Staff report list, review and status updates (/api/v1/staff/reports)."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Request, status
from sqlalchemy import select

from app.audit.service import record
from app.auth.deps import CurrentStaff, DbSession, client_ip
from app.auth.schemas import BarangayOut
from app.core.errors import ApiError
from app.media.schemas import MediaOut
from app.media.service import active_media
from app.models import Report, User
from app.reports.status import change_status
from app.reports.workflow import ALLOWED_TRANSITIONS, STATUS_LABELS, ReportStatus
from app.staff.queries import ReportFilters, map_reports, search_reports
from app.staff.schemas import (
    MapData,
    MapPoint,
    ReporterInfo,
    StaffReportDetail,
    StaffReportPage,
    StaffReportRow,
    StaffTimelineEntry,
    StatusChangeRequest,
)

router = APIRouter(prefix="/staff/reports", tags=["staff"])
map_router = APIRouter(prefix="/staff/map", tags=["staff"])

#: More than enough for one municipality; keeps the map responsive.
MAP_POINT_LIMIT = 5000

REPORT_NOT_FOUND = ApiError(status.HTTP_404_NOT_FOUND, "not_found", "Report not found.")


@router.get("", response_model=StaffReportPage)
def list_reports(
    _staff: CurrentStaff,
    db: DbSession,
    q: Annotated[str | None, Query(max_length=100)] = None,
    status_: Annotated[ReportStatus | None, Query(alias="status")] = None,
    hazard: Annotated[str | None, Query(max_length=40)] = None,
    barangay_id: Annotated[int | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    include_demo: Annotated[bool, Query()] = True,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> StaffReportPage:
    """Search and filter all submitted reports, newest first."""
    filters = ReportFilters(
        q=q.strip() if q and q.strip() else None,
        status=status_,
        hazard=hazard or None,
        barangay_id=barangay_id,
        date_from=date_from,
        date_to=date_to,
        include_demo=include_demo,
    )
    items, total = search_reports(db, filters, limit=limit, offset=offset)
    return StaffReportPage(
        items=[StaffReportRow.model_validate(r) for r in items],
        total=total,
        limit=limit,
        offset=offset,
    )


def _get_report(db: DbSession, reference_no: str) -> Report:
    report = db.scalar(select(Report).where(Report.reference_no == reference_no))
    if report is None:
        raise REPORT_NOT_FOUND
    return report


def _names(db: DbSession, ids: set) -> dict:
    ids.discard(None)
    if not ids:
        return {}
    return dict(db.execute(select(User.id, User.full_name).where(User.id.in_(ids))).all())


def _detail(db: DbSession, report: Report) -> StaffReportDetail:
    reporter = report.reporter
    names = _names(
        db,
        {h.changed_by_id for h in report.history} | {report.verified_by_id, report.resolved_by_id},
    )
    row = StaffReportRow.model_validate(report)
    return StaffReportDetail(
        **row.model_dump(),
        description=report.description,
        municipality=report.municipality,
        province=report.province,
        landmark=report.landmark,
        latitude=report.latitude,
        longitude=report.longitude,
        location_accuracy_m=report.location_accuracy_m,
        location_source=report.location_source,
        external_ref=report.external_ref,
        reporter=ReporterInfo(
            id=reporter.id,
            full_name=reporter.full_name,
            email=reporter.email,
            phone=reporter.phone,
            barangay=BarangayOut.model_validate(reporter.barangay) if reporter.barangay else None,
        )
        if reporter
        else None,
        import_filename=report.import_batch.filename if report.import_batch else None,
        timeline=[
            StaffTimelineEntry(
                status=h.to_status,
                changed_at=h.changed_at,
                by_role="resident"
                if report.reporter_id and h.changed_by_id == report.reporter_id
                else "mdrrmo",
                actor_name=names.get(h.changed_by_id),
                note=h.note,
            )
            for h in report.history
        ],
        media=[MediaOut.from_model(m) for m in active_media(db, report)],
        verified_at=report.verified_at,
        verified_by=names.get(report.verified_by_id),
        verification_notes=report.verification_notes,
        resolved_at=report.resolved_at,
        resolved_by=names.get(report.resolved_by_id),
        resolution_notes=report.resolution_notes,
        allowed_actions=sorted(
            ALLOWED_TRANSITIONS[report.status], key=lambda s: list(ReportStatus).index(s)
        ),
    )


@router.get("/{reference_no}", response_model=StaffReportDetail)
def get_report(
    reference_no: str, staff: CurrentStaff, db: DbSession, request: Request
) -> StaffReportDetail:
    """Full report for review, including reporter details. Every view is audited."""
    report = _get_report(db, reference_no)
    record(
        db,
        "report.viewed",
        actor_id=staff.id,
        ip=client_ip(request),
        entity="report",
        entity_id=report.reference_no,
    )
    db.commit()
    return _detail(db, report)


@router.post("/{reference_no}/status", response_model=StaffReportDetail)
def update_status(
    reference_no: str,
    body: StatusChangeRequest,
    staff: CurrentStaff,
    db: DbSession,
    request: Request,
) -> StaffReportDetail:
    """Move a report along the verification workflow."""
    report = db.scalar(
        select(Report).where(Report.reference_no == reference_no).with_for_update(of=Report)
    )
    if report is None:
        raise REPORT_NOT_FOUND
    if report.status != body.from_status:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "status_changed",
            f"This report was updated by someone else and is now "
            f"{STATUS_LABELS[report.status]}. Review it again before changing its status.",
        )
    change_status(db, report, body.status, staff, body.note, client_ip(request))
    return _detail(db, report)


@map_router.get("/reports", response_model=MapData)
def map_data(
    _staff: CurrentStaff,
    db: DbSession,
    status_: Annotated[ReportStatus | None, Query(alias="status")] = None,
    hazard: Annotated[str | None, Query(max_length=40)] = None,
    barangay_id: Annotated[int | None, Query()] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    include_demo: Annotated[bool, Query()] = True,
) -> MapData:
    """Recorded reports with coordinates, for the disaster map."""
    filters = ReportFilters(
        status=status_,
        hazard=hazard or None,
        barangay_id=barangay_id,
        date_from=date_from,
        date_to=date_to,
        include_demo=include_demo,
    )
    points, without_location, truncated = map_reports(db, filters, limit=MAP_POINT_LIMIT)
    return MapData(
        points=[MapPoint.model_validate(p) for p in points],
        without_location=without_location,
        truncated=truncated,
    )
