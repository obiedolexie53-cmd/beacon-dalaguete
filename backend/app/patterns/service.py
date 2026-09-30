"""Runs the 4.2 pattern methods on the filtered records and words the findings.

Findings are written in the past tense about the recorded dataset (for example
"Recurring landslide incidents were identified in the recorded dataset for
Mantalongon"). They never say what will happen.
"""

from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analysis.schemas import AnalysisFiltersOut
from app.models import Barangay, HazardType
from app.patterns import methods as m
from app.patterns.schemas import (
    CoOccurrenceOut,
    Finding,
    HotspotOut,
    NamedRef,
    PatternAnalysis,
    PatternDataset,
    PatternParameters,
    RecurrenceOut,
    SeasonalityOut,
    TrendOut,
)
from app.staff.queries import ReportFilters, filtered_reports

#: Below this, patterns are not looked for at all.
MIN_RECORDS = 10
#: Findings list at most this many statements of each kind.
FINDINGS_PER_KIND = 3
#: Co-occurrences are mentioned in the findings only from this lift.
NOTABLE_LIFT = 1.5

MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


def _month_year(d: date) -> str:
    return f"{MONTHS[d.month - 1][:3]} {d.year}"


def _join(items: list[str]) -> str:
    return items[0] if len(items) == 1 else f"{', '.join(items[:-1])} and {items[-1]}"


def _load(db: Session, filters: ReportFilters) -> list[m.Incident]:
    base = filtered_reports(filters).subquery()
    rows = db.execute(
        select(
            base.c.reference_no,
            base.c.incident_date,
            HazardType.code,
            base.c.barangay_id,
            base.c.latitude,
            base.c.longitude,
        ).join(HazardType, HazardType.id == base.c.hazard_type_id)
    ).all()
    return [
        m.Incident(
            reference_no=r.reference_no,
            incident_date=r.incident_date,
            hazard=r.code,
            barangay_id=r.barangay_id,
            latitude=float(r.latitude) if r.latitude is not None else None,
            longitude=float(r.longitude) if r.longitude is not None else None,
        )
        for r in rows
    ]


def identify_patterns(
    db: Session,
    filters: ReportFilters,
    filters_out: AnalysisFiltersOut,
    parameters: PatternParameters,
) -> PatternAnalysis:
    incidents = _load(db, filters)
    hazard_names = dict(db.execute(select(HazardType.code, HazardType.name)).all())
    barangay_names = dict(db.execute(select(Barangay.id, Barangay.name)).all())

    def hazard(code: str) -> NamedRef:
        return NamedRef(code=code, name=hazard_names.get(code, code))

    dates = [i.incident_date for i in incidents]
    first = filters.date_from or (min(dates) if dates else None)
    last = filters.date_to or (max(dates) if dates else None)
    months_covered = len(m.month_span(first, last)) if first and last and first <= last else 0
    sufficient = len(incidents) >= MIN_RECORDS and first is not None and last is not None
    dataset = PatternDataset(
        total=len(incidents),
        with_coordinates=sum(1 for i in incidents if i.latitude is not None),
        first_incident=min(dates) if dates else None,
        last_incident=max(dates) if dates else None,
        months_covered=months_covered,
        sufficient=sufficient,
    )
    result = PatternAnalysis(
        filters=filters_out,
        parameters=parameters,
        dataset=dataset,
        findings=[],
        recurring_locations=[],
        hotspots=[],
        seasonality=[],
        trend_months=[],
        trends=[],
        co_occurrence=[],
        generated_at=datetime.now(UTC),
    )
    if not sufficient:
        return result
    assert first is not None and last is not None

    recurring = m.recurring_locations(incidents, parameters.recurrence_min_records)
    spots = m.hotspots(incidents, parameters.hotspot_distance_m, parameters.hotspot_min_records)
    seasons = m.seasonality(incidents, first, last)
    trend_list = m.trends(incidents, first, last)
    pairs = m.co_occurrence(incidents, first, last, parameters.co_occurrence_days)

    result.recurring_locations = [
        RecurrenceOut(
            hazard=hazard(r.hazard),
            barangay_id=r.barangay_id,
            barangay=barangay_names.get(r.barangay_id, "Unknown"),
            count=r.count,
            months_with_records=r.months_with_records,
            years_with_records=r.years_with_records,
            first=r.first,
            last=r.last,
            share_of_hazard=r.share_of_hazard,
        )
        for r in recurring
    ]
    result.hotspots = [
        HotspotOut(
            id=f"H{n}",
            hazard=hazard(h.hazard),
            count=h.count,
            center_latitude=h.center_latitude,
            center_longitude=h.center_longitude,
            radius_m=h.radius_m,
            barangays=[barangay_names.get(b, "Unknown") for b in h.barangay_ids],
            first=h.first,
            last=h.last,
            reference_nos=list(h.reference_nos),
        )
        for n, h in enumerate(spots, start=1)
    ]
    result.seasonality = [
        SeasonalityOut(
            hazard=hazard(s.hazard),
            total=s.total,
            monthly=list(s.monthly),
            peak_months=list(s.peak_months),
            p_value=s.p_value,
            concentrated=s.concentrated,
        )
        for s in seasons
    ]
    result.trend_months = [f"{y:04d}-{mo:02d}" for y, mo in m.month_span(first, last)]
    result.trends = [
        TrendOut(
            hazard=hazard(t.hazard) if t.hazard else None,
            total=t.total,
            months=t.months,
            change_per_year=t.change_per_year,
            tau=t.tau,
            p_value=t.p_value,
            direction=t.direction,
            counts=list(t.counts),
            fit_start=t.fit_start,
            fit_end=t.fit_end,
        )
        for t in trend_list
    ]
    result.co_occurrence = [
        CoOccurrenceOut(
            hazard=hazard(c.hazard),
            with_hazard=hazard(c.with_hazard),
            count=c.count,
            share=c.share,
            lift=c.lift,
        )
        for c in pairs
    ]
    result.findings = _findings(result, parameters)
    return result


def _findings(result: PatternAnalysis, parameters: PatternParameters) -> list[Finding]:
    found: list[Finding] = []
    for r in result.recurring_locations[:FINDINGS_PER_KIND]:
        found.append(
            Finding(
                kind="recurrence",
                hazard=r.hazard.code,
                text=(
                    f"Recurring {r.hazard.name.lower()} incidents were identified in the "
                    f"recorded dataset for {r.barangay}: {r.count} records in "
                    f"{r.months_with_records} different months, from {_month_year(r.first)} "
                    f"to {_month_year(r.last)}."
                ),
            )
        )
    for h in result.hotspots[:FINDINGS_PER_KIND]:
        found.append(
            Finding(
                kind="hotspot",
                hazard=h.hazard.code,
                text=(
                    f"{h.count} {h.hazard.name.lower()} records were clustered within about "
                    f"{h.radius_m:,} m of a common centre point in {_join(h.barangays[:3])} "
                    f"({_month_year(h.first)} to {_month_year(h.last)})."
                ),
            )
        )
    concentrated = [s for s in result.seasonality if s.concentrated and s.peak_months]
    for s in concentrated[:FINDINGS_PER_KIND]:
        months = _join([MONTHS[p - 1] for p in s.peak_months])
        found.append(
            Finding(
                kind="seasonality",
                hazard=s.hazard.code,
                text=(
                    f"{s.hazard.name} records were concentrated in {months}: more were "
                    f"recorded in {'this month' if len(s.peak_months) == 1 else 'these months'} "
                    "than an even spread across the year would give."
                ),
            )
        )
    for t in result.trends:
        if t.direction not in ("increasing", "decreasing"):
            continue
        what = f"recorded {t.hazard.name.lower()} incidents" if t.hazard else "recorded incidents"
        change = abs(t.change_per_year or 0)
        found.append(
            Finding(
                kind="trend",
                hazard=t.hazard.code if t.hazard else None,
                text=(
                    f"Monthly {what} {'rose' if t.direction == 'increasing' else 'fell'} over "
                    f"the {t.months} months covered (about {change:g} records per year). "
                    "Changes in how incidents were reported can also cause this."
                ),
            )
        )
    overall = next((t for t in result.trends if t.hazard is None), None)
    if overall and overall.direction == "no_clear_trend":
        found.append(
            Finding(
                kind="trend",
                hazard=None,
                text=(
                    "No clear upward or downward trend was found in the number of incidents "
                    f"recorded per month over the {overall.months} months covered."
                ),
            )
        )
    notable = [c for c in result.co_occurrence if (c.lift or 0) >= NOTABLE_LIFT]
    days = parameters.co_occurrence_days
    for c in notable[:FINDINGS_PER_KIND]:
        found.append(
            Finding(
                kind="co_occurrence",
                hazard=c.hazard.code,
                text=(
                    f"{c.count} of the {c.hazard.name.lower()} records "
                    f"({round(c.share * 100)}%) had a {c.with_hazard.name.lower()} record "
                    f"within {days} day{'s' if days != 1 else ''}, {c.lift:g} times as often "
                    "as expected from that month's records alone."
                ),
            )
        )
    return found
