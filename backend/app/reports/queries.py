"""Read queries for reports.

Every resident query is scoped to reporter_id = the signed-in resident. There is
no code path that lists another resident's reports.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Report
from app.reports.schemas import StatusCounts


def resident_status_counts(db: Session, reporter_id: uuid.UUID) -> StatusCounts:
    rows = db.execute(
        select(Report.status, func.count())
        .where(Report.reporter_id == reporter_id)
        .group_by(Report.status)
    ).all()
    counts = StatusCounts(**{status.value: count for status, count in rows})
    counts.total = sum(count for _, count in rows)
    return counts


def resident_reports(
    db: Session, reporter_id: uuid.UUID, *, limit: int, offset: int = 0
) -> tuple[list[Report], int]:
    scope = Report.reporter_id == reporter_id
    items = db.scalars(
        select(Report)
        .where(scope)
        .order_by(Report.submitted_at.desc(), Report.reference_no.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    total = db.scalar(select(func.count()).select_from(Report).where(scope)) or 0
    return list(items), total
