"""4.2 Hazard Pattern Identification: the methods, as plain functions.

Each method describes patterns in RECORDED incidents only:

- recurrence:     hazard types recorded again and again in the same barangay;
- hotspots:       places where incidents of one hazard type were recorded close
                  together (DBSCAN clustering on coordinates);
- seasonality:    months of the year in which a hazard type was recorded more
                  often than an even spread would give (chi-square test);
- trends:         whether monthly recorded counts rose or fell over the period
                  (Mann-Kendall test with Sen's slope);
- co-occurrence:  hazard types recorded within a few days of each other
                  anywhere in the municipality.

None of these forecasts anything. Results depend on what was reported and
recorded (for example, more reports after the app was introduced), so they
support, and never replace, MDRRMO assessment.
"""

import calendar
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date
from typing import Literal

import numpy as np
from scipy import stats
from sklearn.cluster import DBSCAN

EARTH_RADIUS_M = 6_371_000
SIGNIFICANCE = 0.05


@dataclass(frozen=True)
class Incident:
    reference_no: str
    incident_date: date
    hazard: str
    barangay_id: int | None
    latitude: float | None
    longitude: float | None


# --- Recurrence ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Recurrence:
    hazard: str
    barangay_id: int
    count: int
    months_with_records: int
    years_with_records: int
    first: date
    last: date
    share_of_hazard: float


def recurring_locations(incidents: list[Incident], min_records: int = 3) -> list[Recurrence]:
    """Hazard types recorded at least `min_records` times, in at least two different
    months, in the same barangay. Most records first."""
    groups: dict[tuple[str, int], list[Incident]] = defaultdict(list)
    per_hazard = Counter(i.hazard for i in incidents)
    for incident in incidents:
        if incident.barangay_id is not None:
            groups[(incident.hazard, incident.barangay_id)].append(incident)
    found = []
    for (hazard, barangay_id), items in groups.items():
        months = {(i.incident_date.year, i.incident_date.month) for i in items}
        if len(items) < min_records or len(months) < 2:
            continue
        dates = [i.incident_date for i in items]
        found.append(
            Recurrence(
                hazard=hazard,
                barangay_id=barangay_id,
                count=len(items),
                months_with_records=len(months),
                years_with_records=len({d.year for d in dates}),
                first=min(dates),
                last=max(dates),
                share_of_hazard=round(len(items) / per_hazard[hazard], 4),
            )
        )
    return sorted(found, key=lambda r: (-r.count, -r.months_with_records, r.hazard, r.barangay_id))


# --- Hotspots (DBSCAN) --------------------------------------------------------------------


@dataclass(frozen=True)
class Hotspot:
    hazard: str
    count: int
    center_latitude: float
    center_longitude: float
    #: Distance from the centre to the farthest record in the cluster.
    radius_m: int
    barangay_ids: tuple[int, ...]  # most records first
    first: date
    last: date
    reference_nos: tuple[str, ...]


def _haversine_m(lat1, lng1, lat2, lng2) -> np.ndarray:
    lat1, lng1, lat2, lng2 = map(np.radians, (lat1, lng1, lat2, lng2))
    a = (
        np.sin((lat2 - lat1) / 2) ** 2
        + np.cos(lat1) * np.cos(lat2) * np.sin((lng2 - lng1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_M * np.arcsin(np.sqrt(a))


def hotspots(
    incidents: list[Incident], distance_m: float = 500, min_records: int = 3
) -> list[Hotspot]:
    """Cluster located incidents of each hazard type with DBSCAN (haversine distance).

    A record joins a cluster when at least `min_records` records of the same hazard
    type (itself included) lie within `distance_m` metres of it, or of another
    record in the cluster. Records far from others are left out as noise.
    """
    by_hazard: dict[str, list[Incident]] = defaultdict(list)
    for incident in incidents:
        if incident.latitude is not None and incident.longitude is not None:
            by_hazard[incident.hazard].append(incident)
    found: list[Hotspot] = []
    for hazard, items in by_hazard.items():
        if len(items) < min_records:
            continue
        coords = np.radians([[i.latitude, i.longitude] for i in items])
        labels = DBSCAN(
            eps=distance_m / EARTH_RADIUS_M,
            min_samples=min_records,
            metric="haversine",
            algorithm="ball_tree",
        ).fit_predict(coords)
        for label in sorted(set(labels) - {-1}):
            members = [item for item, lab in zip(items, labels, strict=True) if lab == label]
            lats = np.array([m.latitude for m in members])
            lngs = np.array([m.longitude for m in members])
            center_lat, center_lng = float(lats.mean()), float(lngs.mean())
            radius = float(_haversine_m(center_lat, center_lng, lats, lngs).max())
            barangays = Counter(m.barangay_id for m in members if m.barangay_id is not None)
            dates = [m.incident_date for m in members]
            found.append(
                Hotspot(
                    hazard=hazard,
                    count=len(members),
                    center_latitude=round(center_lat, 6),
                    center_longitude=round(center_lng, 6),
                    radius_m=math.ceil(radius),
                    barangay_ids=tuple(
                        b for b, _ in sorted(barangays.items(), key=lambda kv: (-kv[1], kv[0]))
                    ),
                    first=min(dates),
                    last=max(dates),
                    reference_nos=tuple(sorted(m.reference_no for m in members)),
                )
            )
    return sorted(found, key=lambda h: (-h.count, h.hazard, h.center_latitude))


# --- Seasonality --------------------------------------------------------------------------


def month_span(first: date, last: date) -> list[tuple[int, int]]:
    months, (year, month) = [], (first.year, first.month)
    while (year, month) <= (last.year, last.month):
        months.append((year, month))
        year, month = (year, month + 1) if month < 12 else (year + 1, 1)
    return months


@dataclass(frozen=True)
class Seasonality:
    hazard: str
    total: int
    #: Records in each month of the year, January first.
    monthly: tuple[int, ...]
    #: Months with clearly more records than an even spread (1 = January).
    peak_months: tuple[int, ...]
    #: Chi-square test against an even spread over the months covered. None when
    #: there are too few records to test.
    p_value: float | None
    concentrated: bool


def seasonality(
    incidents: list[Incident], first: date, last: date, min_records: int = 12
) -> list[Seasonality]:
    """Compare each hazard type's records per month of the year with an even spread.

    The expected count for a month allows for how often that month occurs in the
    period covered (a 30-month period includes some months three times).
    """
    span = month_span(first, last)
    exposure = np.array([sum(1 for _, m in span if m == month) for month in range(1, 13)])
    by_hazard: dict[str, list[int]] = defaultdict(lambda: [0] * 12)
    for incident in incidents:
        by_hazard[incident.hazard][incident.incident_date.month - 1] += 1
    found = []
    for hazard, monthly in by_hazard.items():
        total = sum(monthly)
        observed = np.array(monthly)
        covered = exposure > 0
        expected = np.where(covered, total * exposure / exposure.sum(), 0)
        p_value = None
        peaks: tuple[int, ...] = ()
        if total >= min_records and covered.sum() >= 6:
            p_value = float(stats.chisquare(observed[covered], expected[covered]).pvalue)
            if p_value < SIGNIFICANCE:
                # Standardised residuals above 2: clearly more than an even spread.
                residuals = np.where(covered, (observed - expected) / np.sqrt(expected + 1e-9), 0)
                peaks = tuple(int(m) + 1 for m in np.flatnonzero(residuals >= 2))
        found.append(
            Seasonality(
                hazard=hazard,
                total=total,
                monthly=tuple(monthly),
                peak_months=peaks,
                p_value=None if p_value is None else round(p_value, 6),
                concentrated=p_value is not None and p_value < SIGNIFICANCE,
            )
        )
    return sorted(found, key=lambda s: (-s.total, s.hazard))


# --- Trends -------------------------------------------------------------------------------


@dataclass(frozen=True)
class Trend:
    hazard: str | None  # None = all hazard types together
    total: int
    months: int
    #: Sen's slope, in records per year (median of pairwise slopes).
    change_per_year: float | None
    tau: float | None
    p_value: float | None
    direction: Literal["increasing", "decreasing", "no_clear_trend", "insufficient_data"]
    #: Records in each month of the period, oldest first.
    counts: tuple[int, ...] = ()
    #: Sen's line at the first and last month (for drawing it over the data only).
    fit_start: float | None = None
    fit_end: float | None = None


def _trend(hazard: str | None, counts: list[int], min_months: int, min_records: int) -> Trend:
    total = sum(counts)
    if len(counts) < min_months or total < min_records:
        return Trend(
            hazard, total, len(counts), None, None, None, "insufficient_data", tuple(counts)
        )
    x = np.arange(len(counts))
    result = stats.kendalltau(x, counts)
    tau, p_value = float(result.statistic), float(result.pvalue)
    sen = stats.theilslopes(counts, x)
    slope, intercept = float(sen.slope), float(sen.intercept)
    if math.isnan(tau):  # every month had the same count
        tau, p_value = 0.0, 1.0
    direction: Literal["increasing", "decreasing", "no_clear_trend"] = "no_clear_trend"
    if p_value < SIGNIFICANCE:
        direction = "increasing" if tau > 0 else "decreasing"
    return Trend(
        hazard,
        total,
        len(counts),
        round(slope * 12, 2),
        round(tau, 4),
        round(p_value, 6),
        direction,
        tuple(counts),
        round(max(0.0, intercept), 3),
        round(max(0.0, intercept + slope * (len(counts) - 1)), 3),
    )


def trends(
    incidents: list[Incident],
    first: date,
    last: date,
    min_months: int = 12,
    min_records: int = 10,
) -> list[Trend]:
    """Mann-Kendall trend test on monthly recorded counts, overall and per hazard type."""
    span = month_span(first, last)
    index = {month: i for i, month in enumerate(span)}
    overall = [0] * len(span)
    per_hazard: dict[str, list[int]] = defaultdict(lambda: [0] * len(span))
    for incident in incidents:
        key = (incident.incident_date.year, incident.incident_date.month)
        if key in index:
            overall[index[key]] += 1
            per_hazard[incident.hazard][index[key]] += 1
    found = [_trend(None, overall, min_months, min_records)]
    found += sorted(
        (_trend(h, c, min_months, min_records) for h, c in per_hazard.items()),
        key=lambda t: (-t.total, t.hazard or ""),
    )
    return found


# --- Co-occurrence ------------------------------------------------------------------------


@dataclass(frozen=True)
class CoOccurrence:
    hazard: str
    with_hazard: str
    #: Records of `hazard` with a `with_hazard` record anywhere in Dalaguete within the window.
    count: int
    #: count / all records of `hazard`.
    share: float
    #: How many times more often than if each month's `with_hazard` records were spread
    #: evenly over that month (1 = no more than that). Comparing within the month means
    #: two hazards that merely share a rainy season do not look linked.
    lift: float | None


def co_occurrence(
    incidents: list[Incident],
    first: date,
    last: date,
    window_days: int = 2,
    min_count: int = 3,
) -> list[CoOccurrence]:
    """Hazard types recorded within `window_days` of each other, anywhere in the
    municipality (weather events such as typhoons affect many barangays at once)."""
    span = 2 * window_days + 1
    dates: dict[str, list[int]] = defaultdict(list)
    per_month: dict[str, Counter] = defaultdict(Counter)
    for incident in incidents:
        d = incident.incident_date
        dates[incident.hazard].append(d.toordinal())
        per_month[incident.hazard][(d.year, d.month)] += 1
    found = []
    for a in sorted(dates):
        for b in sorted(dates):
            if a == b:
                continue
            b_days = np.sort(np.array(dates[b]))
            count, expected = 0, 0.0
            for day in dates[a]:
                i = np.searchsorted(b_days, day - window_days)
                if i < len(b_days) and b_days[i] <= day + window_days:
                    count += 1
                d = date.fromordinal(day)
                month_days = calendar.monthrange(d.year, d.month)[1]
                n_b = per_month[b][(d.year, d.month)]
                expected += 1 - (1 - min(span, month_days) / month_days) ** n_b
            if count < min_count:
                continue
            found.append(
                CoOccurrence(
                    hazard=a,
                    with_hazard=b,
                    count=count,
                    share=round(count / len(dates[a]), 4),
                    lift=round(count / expected, 2) if expected > 0 else None,
                )
            )
    return sorted(found, key=lambda c: (-(c.lift or 0), -c.count, c.hazard, c.with_hazard))
