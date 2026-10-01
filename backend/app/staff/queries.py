from dataclasses import dataclass
from datetime import date

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models import HazardType, Report, ReportSource, User
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


@dataclass(frozen=True)
class ReportFilters:
    q: str | None = None
    status: ReportStatus | None = None
    #: Any of these statuses (used by historical analysis).
    statuses: tuple[ReportStatus, ...] | None = None
    source: ReportSource | None = None
    hazard: str | None = None
    barangay_id: int | None = None
    date_from: date | None = None
    date_to: date | None = None
    include_demo: bool = True


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def filtered_reports(filters: ReportFilters) -> Select:
    """SELECT of reports matching the staff filters (shared by the list and the map)."""
    stmt = select(Report)
    if filters.q:
        pattern = f"%{_escape_like(filters.q.strip())}%"
        stmt = stmt.outerjoin(User, User.id == Report.reporter_id).where(
            or_(
                Report.reference_no.ilike(pattern, escape="\\"),
                Report.description.ilike(pattern, escape="\\"),
                Report.landmark.ilike(pattern, escape="\\"),
                Report.external_ref.ilike(pattern, escape="\\"),
                User.full_name.ilike(pattern, escape="\\"),
            )
        )
    if filters.status:
        stmt = stmt.where(Report.status == filters.status)
    if filters.statuses:
        stmt = stmt.where(Report.status.in_(filters.statuses))
    if filters.source:
        stmt = stmt.where(Report.source == filters.source)
    if filters.hazard:
        stmt = stmt.join(HazardType, HazardType.id == Report.hazard_type_id).where(
            HazardType.code == filters.hazard
        )
    if filters.barangay_id:
        stmt = stmt.where(Report.barangay_id == filters.barangay_id)
    if filters.date_from:
        stmt = stmt.where(Report.incident_date >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(Report.incident_date <= filters.date_to)
    return scoped(stmt, filters.include_demo)


def search_reports(
    db: Session, filters: ReportFilters, *, limit: int, offset: int
) -> tuple[list[Report], int]:
    """Staff report search. Text search covers reference number, description, landmark
    and reporter name; the other filters are exact."""
    stmt = filtered_reports(filters)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(
        stmt.order_by(Report.submitted_at.desc(), Report.reference_no.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return list(items), total


def map_reports(
    db: Session, filters: ReportFilters, *, limit: int
) -> tuple[list[Report], int, bool]:
    """Reports with coordinates for the map, plus how many matching reports have none."""
    stmt = filtered_reports(filters)
    located = stmt.where(Report.latitude.is_not(None), Report.longitude.is_not(None))
    unlocated = stmt.where(or_(Report.latitude.is_(None), Report.longitude.is_(None)))
    without_location = db.scalar(select(func.count()).select_from(unlocated.subquery())) or 0
    points = list(db.scalars(located.order_by(Report.submitted_at.desc()).limit(limit + 1)))
    return points[:limit], without_location, len(points) > limit
