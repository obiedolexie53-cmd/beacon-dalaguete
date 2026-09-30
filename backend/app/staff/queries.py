from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models import Report
from app.reports.workflow import ReportStatus
from app.staff.schemas import StaffStatusCounts


def scoped(stmt: Select, include_demo: bool) -> Select:
    """Optionally leave out fictional DEMO records (e.g. when evaluating with real reports)."""
    return stmt if include_demo else stmt.where(Report.is_demo.is_(False))


def status_counts(db: Session, include_demo: bool) -> StaffStatusCounts:
    rows = db.execute(
        scoped(select(Report.status, func.count()).group_by(Report.status), include_demo)
    ).all()
    by_status = {status: count for status, count in rows}
    return StaffStatusCounts(
        total=sum(by_status.values()),
        new=by_status.get(ReportStatus.SUBMITTED, 0),
        under_verification=by_status.get(ReportStatus.UNDER_VERIFICATION, 0),
        needs_clarification=by_status.get(ReportStatus.NEEDS_CLARIFICATION, 0),
        verified=by_status.get(ReportStatus.VERIFIED, 0),
        resolved=by_status.get(ReportStatus.RESOLVED, 0),
    )


def recent_reports(db: Session, include_demo: bool, limit: int) -> list[Report]:
    stmt = scoped(
        select(Report).order_by(Report.submitted_at.desc(), Report.reference_no.desc()),
        include_demo,
    )
    return list(db.scalars(stmt.limit(limit)))
