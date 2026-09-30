"""4.1 Incident Data Analysis: descriptive counts of recorded incidents.

Everything here summarises the recorded dataset (when, where and what was
recorded). Nothing here forecasts or predicts future incidents.
"""

import csv
import io
from collections import Counter, defaultdict
from collections.abc import Iterator
from datetime import UTC, date, datetime

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.analysis.schemas import (
    AnalysisFiltersOut,
    AnalysisScope,
    BarangayCount,
    DatasetSummary,
    HazardBarangayCount,
    HazardCount,
    HazardMonthCount,
    IncidentAnalysis,
    IndexedCount,
    PeriodCount,
)
from app.models import Barangay, HazardType, Report, ReportSource
from app.reports.workflow import ReportStatus
from app.staff.queries import ReportFilters, filtered_reports

CONFIRMED_STATUSES = (ReportStatus.VERIFIED, ReportStatus.RESOLVED)


def statuses_for(scope: AnalysisScope) -> tuple[ReportStatus, ...]:
    return CONFIRMED_STATUSES if scope == "confirmed" else tuple(ReportStatus)


def _rows(db: Session, filters: ReportFilters) -> list:
    """One lightweight row per matching report (the dataset is municipal-sized)."""
    base = filtered_reports(filters).subquery()
    stmt: Select = select(
        base.c.incident_date,
        base.c.incident_time,
        HazardType.code,
        base.c.barangay_id,
        base.c.source,
        base.c.is_demo,
        base.c.latitude.is_not(None).label("located"),
    ).join(HazardType, HazardType.id == base.c.hazard_type_id)
    return list(db.execute(stmt).all())


def _months_between(first: date, last: date) -> Iterator[str]:
    year, month = first.year, first.month
    while (year, month) <= (last.year, last.month):
        yield f"{year:04d}-{month:02d}"
        year, month = (year, month + 1) if month < 12 else (year + 1, 1)


def analyse_incidents(
    db: Session, filters: ReportFilters, scope: AnalysisScope
) -> IncidentAnalysis:
    rows = _rows(db, filters)
    total = len(rows)
    hazard_names = dict(db.execute(select(HazardType.code, HazardType.name)).all())
    barangay_names = dict(db.execute(select(Barangay.id, Barangay.name)).all())

    def share(count: int) -> float:
        return round(count / total, 4) if total else 0.0

    by_hazard = Counter(r.code for r in rows)
    by_barangay = Counter(r.barangay_id for r in rows if r.barangay_id is not None)
    pairs = Counter((r.code, r.barangay_id) for r in rows if r.barangay_id is not None)
    hazards_in: dict[int, Counter] = defaultdict(Counter)
    for (code, barangay_id), count in pairs.items():
        hazards_in[barangay_id][code] = count

    dates = [r.incident_date for r in rows]
    first = filters.date_from or (min(dates) if dates else None)
    last = filters.date_to or (max(dates) if dates else None)
    per_month = Counter(f"{d.year:04d}-{d.month:02d}" for d in dates)
    months = list(_months_between(first, last)) if first and last and first <= last else []
    if len(months) > 600:  # an absurd range: keep only months with records
        months = sorted(per_month)
    per_month_of_year = Counter(d.month for d in dates)
    per_weekday = Counter(d.isoweekday() for d in dates)
    per_hour = Counter(r.incident_time.hour for r in rows if r.incident_time is not None)
    hazard_months = Counter((r.code, r.incident_date.month) for r in rows)

    def top(barangay_id: int) -> tuple[str, int]:
        code, count = min(hazards_in[barangay_id].items(), key=lambda item: (-item[1], item[0]))
        return code, count

    barangay_rows = []
    for barangay_id, count in sorted(
        by_barangay.items(), key=lambda item: (-item[1], barangay_names.get(item[0], ""))
    ):
        top_code, top_count = top(barangay_id)
        barangay_rows.append(
            BarangayCount(
                id=barangay_id,
                name=barangay_names.get(barangay_id, "Unknown"),
                count=count,
                share=share(count),
                top_hazard=top_code,
                top_hazard_count=top_count,
            )
        )

    return IncidentAnalysis(
        filters=AnalysisFiltersOut(
            scope=scope,
            statuses=list(filters.statuses or ()),
            hazard=filters.hazard,
            barangay_id=filters.barangay_id,
            source=filters.source,
            date_from=filters.date_from,
            date_to=filters.date_to,
            include_demo=filters.include_demo,
        ),
        dataset=DatasetSummary(
            total=total,
            from_app=sum(1 for r in rows if r.source == ReportSource.RESIDENT),
            imported=sum(1 for r in rows if r.source == ReportSource.IMPORT),
            demo=sum(1 for r in rows if r.is_demo),
            with_coordinates=sum(1 for r in rows if r.located),
            with_time=sum(1 for r in rows if r.incident_time is not None),
            first_incident=min(dates) if dates else None,
            last_incident=max(dates) if dates else None,
        ),
        by_hazard=[
            HazardCount(
                code=code, name=hazard_names.get(code, code), count=count, share=share(count)
            )
            for code, count in sorted(by_hazard.items(), key=lambda item: (-item[1], item[0]))
        ],
        by_barangay=barangay_rows,
        without_barangay=sum(1 for r in rows if r.barangay_id is None),
        by_month=[PeriodCount(month=m, count=per_month.get(m, 0)) for m in months],
        by_month_of_year=[IndexedCount(key=m, count=per_month_of_year[m]) for m in range(1, 13)],
        by_hour=[IndexedCount(key=h, count=per_hour[h]) for h in range(24)],
        unknown_time=sum(1 for r in rows if r.incident_time is None),
        by_weekday=[IndexedCount(key=d, count=per_weekday[d]) for d in range(1, 8)],
        hazard_by_barangay=[
            HazardBarangayCount(hazard=code, barangay_id=barangay_id, count=count)
            for (code, barangay_id), count in sorted(pairs.items(), key=lambda item: item[0])
        ],
        hazard_by_month_of_year=[
            HazardMonthCount(hazard=code, month_of_year=month, count=count)
            for (code, month), count in sorted(hazard_months.items())
        ],
        generated_at=datetime.now(UTC),
    )


EXPORT_COLUMNS = (
    "reference_no",
    "source",
    "external_ref",
    "incident_date",
    "incident_time",
    "hazard_code",
    "hazard",
    "other_hazard",
    "barangay",
    "landmark",
    "latitude",
    "longitude",
    "status",
    "recorded_at",
    "is_demo",
)


def _safe_cell(value: str | None) -> str:
    """Stop spreadsheet programs from treating text as a formula (CSV injection)."""
    if not value:
        return ""
    return f"'{value}" if value[0] in "=+-@\t\r" else value


def export_csv(db: Session, filters: ReportFilters) -> str:
    """Matching reports as CSV, WITHOUT reporter details or free-text descriptions
    (which may contain personal information)."""
    reports = db.scalars(
        filtered_reports(filters).order_by(Report.incident_date, Report.reference_no)
    ).all()
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(EXPORT_COLUMNS)
    for r in reports:
        writer.writerow(
            [
                r.reference_no,
                r.source.value,
                _safe_cell(r.external_ref),
                r.incident_date.isoformat(),
                r.incident_time.strftime("%H:%M") if r.incident_time else "",
                r.hazard_type.code,
                r.hazard_type.name,
                _safe_cell(r.other_hazard_text),
                r.barangay.name if r.barangay else "",
                _safe_cell(r.landmark),
                r.latitude if r.latitude is not None else "",
                r.longitude if r.longitude is not None else "",
                r.status.value,
                r.submitted_at.isoformat(),
                "yes" if r.is_demo else "no",
            ]
        )
    return out.getvalue()
