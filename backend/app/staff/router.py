from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Query

from app.auth.deps import CurrentStaff, DbSession
from app.staff.queries import recent_reports, status_counts
from app.staff.schemas import StaffDashboard, StaffReportRow

router = APIRouter(prefix="/staff", tags=["staff"])

RECENT_REPORTS_ON_DASHBOARD = 10


@router.get("/dashboard", response_model=StaffDashboard)
def staff_dashboard(
    _staff: CurrentStaff,
    db: DbSession,
    include_demo: Annotated[bool, Query()] = True,
) -> StaffDashboard:
    """Report counts by status and the most recently submitted reports (all residents)."""
    return StaffDashboard(
        counts=status_counts(db, include_demo),
        recent_reports=[
            StaffReportRow.model_validate(r)
            for r in recent_reports(db, include_demo, RECENT_REPORTS_ON_DASHBOARD)
        ],
        include_demo=include_demo,
        generated_at=datetime.now(UTC),
    )
