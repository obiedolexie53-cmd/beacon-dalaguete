"""Historical analysis for MDRRMO personnel (/api/v1/staff/analysis)."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.analysis.schemas import AnalysisScope, IncidentAnalysis
from app.analysis.service import analyse_incidents, export_csv, statuses_for
from app.audit.service import record
from app.auth.deps import CurrentStaff, DbSession, client_ip
from app.core.errors import ApiError
from app.models import ReportSource
from app.reports.validation import local_now
from app.staff.queries import ReportFilters

router = APIRouter(prefix="/staff/analysis", tags=["staff"])


class AnalysisParams:
    def __init__(
        self,
        scope: Annotated[AnalysisScope, Query()] = "confirmed",
        hazard: Annotated[str | None, Query(max_length=40)] = None,
        barangay_id: Annotated[int | None, Query()] = None,
        source: Annotated[ReportSource | None, Query()] = None,
        date_from: Annotated[date | None, Query()] = None,
        date_to: Annotated[date | None, Query()] = None,
        include_demo: Annotated[bool, Query()] = True,
    ):
        if date_from and date_to and date_from > date_to:
            raise ApiError(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "validation_error",
                "The start date must be on or before the end date.",
                fields={"date_from": "Must be on or before the end date"},
            )
        self.scope = scope
        self.filters = ReportFilters(
            statuses=statuses_for(scope),
            hazard=hazard or None,
            barangay_id=barangay_id,
            source=source,
            date_from=date_from,
            date_to=date_to,
            include_demo=include_demo,
        )


Params = Annotated[AnalysisParams, Depends()]


@router.get("/incidents", response_model=IncidentAnalysis)
def incident_analysis(_staff: CurrentStaff, db: DbSession, params: Params) -> IncidentAnalysis:
    """Counts of recorded incidents by hazard, barangay and time (descriptive only)."""
    return analyse_incidents(db, params.filters, params.scope)


@router.get(
    "/incidents/export",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
def export_incidents(
    staff: CurrentStaff, db: DbSession, params: Params, request: Request
) -> Response:
    """The matching records as CSV, without personal details. Every export is audited."""
    body = export_csv(db, params.filters)
    filters = params.filters
    record(
        db,
        "reports.exported",
        actor_id=staff.id,
        ip=client_ip(request),
        entity="report",
        details={
            "scope": params.scope,
            "hazard": filters.hazard,
            "barangay_id": filters.barangay_id,
            "source": filters.source.value if filters.source else None,
            "date_from": filters.date_from.isoformat() if filters.date_from else None,
            "date_to": filters.date_to.isoformat() if filters.date_to else None,
            "include_demo": filters.include_demo,
            "rows": body.count("\n") - 1,
        },
    )
    db.commit()
    filename = f"beacon-incidents-{local_now():%Y%m%d-%H%M}.csv"
    return Response(
        content=body.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
