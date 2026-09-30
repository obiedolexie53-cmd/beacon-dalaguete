from typing import Annotated

from fastapi import APIRouter, Query, Request, Response, status
from sqlalchemy import select

from app.auth.deps import CurrentResident, DbSession, client_ip
from app.models import HazardType
from app.reports.queries import resident_reports, resident_status_counts
from app.reports.schemas import (
    HazardTypeOut,
    ReportCreate,
    ReportPage,
    ReportSummary,
    ResidentDashboard,
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
