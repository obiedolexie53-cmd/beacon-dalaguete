from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status
from sqlalchemy import select

from app.auth.deps import CurrentResident, DbSession, client_ip
from app.media.schemas import MediaOut
from app.media.service import OPEN_FOR_EVIDENCE, active_media, get_own_report
from app.models import HazardType
from app.reports.queries import resident_reports, resident_status_counts
from app.reports.schemas import (
    HazardTypeOut,
    ReportCreate,
    ReportDetail,
    ReportPage,
    ReportSummary,
    ResidentDashboard,
    TimelineEntry,
)
from app.reports.service import create_report, find_existing_submission

RECENT_REPORTS_ON_DASHBOARD = 3

public_router = APIRouter(tags=["reports"])
resident_router = APIRouter(prefix="/me", tags=["resident"])


@public_router.get("/hazard-types", response_model=list[HazardTypeOut])
def list_hazard_types(db: DbSession) -> list[HazardType]:
    """Active hazard types, in display order."""
    return list(
        db.scalars(select(HazardType).where(HazardType.is_active).order_by(HazardType.sort_order))
    )


@resident_router.get("/dashboard", response_model=ResidentDashboard)
def resident_dashboard(user: CurrentResident, db: DbSession) -> ResidentDashboard:
    """Status counts and most recent reports for the signed-in resident only."""
    recent, _ = resident_reports(db, user.id, limit=RECENT_REPORTS_ON_DASHBOARD)
    return ResidentDashboard(
        counts=resident_status_counts(db, user.id),
        recent_reports=[ReportSummary.model_validate(r) for r in recent],
    )


@resident_router.get("/reports", response_model=ReportPage)
def list_my_reports(
    user: CurrentResident,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ReportPage:
    """The signed-in resident's own reports, newest first."""
    items, total = resident_reports(db, user.id, limit=limit, offset=offset)
    return ReportPage(items=[ReportSummary.model_validate(r) for r in items], total=total)


@resident_router.post(
    "/reports",
    response_model=ReportSummary,
    status_code=status.HTTP_201_CREATED,
    responses={200: {"description": "Already submitted (retry); the original report"}},
)
def submit_report(
    body: ReportCreate, user: CurrentResident, db: DbSession, request: Request, response: Response
) -> ReportSummary:
    """Submit a new report. It always starts as Submitted until MDRRMO personnel review it.

    Retrying with the same client_request_id returns the original report (200)
    instead of creating a duplicate.
    """
    existing = find_existing_submission(db, user, body)
    if existing is not None:
        response.status_code = status.HTTP_200_OK
        return ReportSummary.model_validate(existing)
    return ReportSummary.model_validate(create_report(db, user, body, client_ip(request)))


@resident_router.get("/reports/{reference_no}", response_model=ReportDetail)
def get_my_report(reference_no: str, user: CurrentResident, db: DbSession) -> ReportDetail:
    """Full details of one of the resident's own reports, with status history and evidence."""
    report = get_own_report(db, user, reference_no)
    summary = ReportSummary.model_validate(report)
    return ReportDetail(
        **summary.model_dump(),
        description=report.description,
        municipality=report.municipality,
        province=report.province,
        landmark=report.landmark,
        latitude=report.latitude,
        longitude=report.longitude,
        location_accuracy_m=report.location_accuracy_m,
        location_source=report.location_source,
        timeline=[
            TimelineEntry(
                status=entry.to_status,
                changed_at=entry.changed_at,
                by="you" if entry.changed_by_id == user.id else "mdrrmo",
                note=entry.note,
            )
            for entry in report.history
        ],
        media=[MediaOut.from_model(m) for m in active_media(db, report)],
        evidence_open=report.status in OPEN_FOR_EVIDENCE,
    )
