"""Generated DEMO incident history for trying out historical analysis.

EVERYTHING HERE IS INVENTED. The records are not real MDRRMO data and the
seasonal patterns below are a rough, made-up approximation (a rainy season from
June to December, typhoons from July to November, landslides in upland
barangays, floods near the coast, more fires in the dry months). The barangay
positions are pseudo-centroids (upland barangays placed west, coastal ones east)
and are NOT real locations. Records are saved with is_demo = True, their
descriptions start with "DEMO DATA", and they are numbered IMP-YYYY-NNNNNN.

Given the same seed and end date the output is always the same, so analysis
results can be reproduced.
"""

import hashlib
import math
import random
from dataclasses import dataclass
from datetime import date, time, timedelta
from decimal import Decimal

from app.imports.records import Lookups, RecordRow, name_key
from app.reports.workflow import ReportStatus

DEMO_HISTORY_FILENAME = "DEMO history (generated, not real data)"
DEFAULT_SEED = 1

UPLAND = [
    "Mantalongon",
    "Obong",
    "Cawayan",
    "Manlapay",
    "Babayongan",
    "Dumalan",
    "Malones",
    "Catolohan",
    "Jolomaynon",
    "Maloray",
]
COASTAL = ["Poblacion", "Casay", "Tuba", "Coro", "Sacsac", "Tapun", "Ablayan", "Balud"]

RAINY = set(range(6, 13))  # June to December
TYPHOON = set(range(7, 12))  # July to November


@dataclass(frozen=True)
class _Hazard:
    code: str
    #: Expected records per month for each month of the year (index 0 = January).
    monthly: tuple[float, ...]
    places: str  # "upland", "coastal" or "any"
    #: Typical hours of the day (weights for 24 hours are built from these).
    peak_hours: tuple[int, ...]
    descriptions: tuple[str, ...]


def _by_month(rainy: float, dry: float, peak: set[int] | None = None, peak_rate=0.0):
    return tuple(
        peak_rate if peak and m in peak else rainy if m in RAINY else dry for m in range(1, 13)
    )


HAZARDS = [
    _Hazard(
        "landslide",
        _by_month(2.2, 0.3, {9, 10, 11}, 3.2),
        "upland",
        (14, 15, 16, 17, 18, 19, 2, 3),
        (
            "Soil and rocks slid onto the barangay road after continuous rain.",
            "Small landslide beside a farm-to-market road; road partly blocked.",
            "Slope failure behind houses; residents moved to the barangay hall.",
        ),
    ),
    _Hazard(
        "flood",
        _by_month(2.0, 0.3, {8, 9, 10, 11}, 2.8),
        "coastal",
        (15, 16, 17, 18, 19, 20, 21, 22),
        (
            "Knee-deep floodwater on the national highway.",
            "River overflowed into low-lying houses near the creek.",
            "Flooded street near the public market; vehicles slowed down.",
        ),
    ),
    _Hazard(
        "heavy_rainfall",
        _by_month(1.8, 0.4),
        "any",
        (13, 14, 15, 16, 17, 18),
        (
            "Continuous heavy rain for several hours; drainage canals full.",
            "Heavy downpour reported; water collecting on the road.",
        ),
    ),
    _Hazard(
        "typhoon",
        _by_month(0.25, 0.03, TYPHOON, 0.9),
        "any",
        tuple(range(24)),
        (
            "Typhoon conditions: strong rain and wind across the barangay.",
            "Typhoon damage to roofs and fallen trees reported.",
        ),
    ),
    _Hazard(
        "storm_surge",
        _by_month(0.05, 0.0, {8, 9, 10, 11}, 0.35),
        "coastal",
        (5, 6, 7, 17, 18, 19),
        ("Sea water reached coastal houses during high tide and strong winds.",),
    ),
    _Hazard(
        "strong_winds",
        _by_month(0.8, 0.3),
        "any",
        (11, 12, 13, 14, 15, 16, 17),
        (
            "Strong winds toppled a tree across the road.",
            "Roof sheets blown off a house by strong winds.",
        ),
    ),
    _Hazard(
        "fire",
        tuple(1.6 if m in (3, 4, 5) else 0.5 for m in range(1, 13)),
        "any",
        (10, 11, 12, 13, 14, 15, 16, 20, 21),
        (
            "House fire; neighbours helped put it out before responders arrived.",
            "Grass fire spreading near farmland.",
        ),
    ),
    _Hazard(
        "earthquake",
        tuple(0.08 for _ in range(12)),
        "any",
        tuple(range(24)),
        ("Ground shaking felt; minor cracks reported on walls.",),
    ),
    _Hazard(
        "other",
        tuple(0.1 for _ in range(12)),
        "any",
        tuple(range(24)),
        ("Sinkhole reported beside the barangay road.",),
    ),
]
_BY_CODE = {h.code: h for h in HAZARDS}

#: Hazards that often come with a typhoon, and where.
TYPHOON_FOLLOW_UPS = ("flood", "landslide", "strong_winds", "heavy_rainfall")


def _poisson(rng: random.Random, rate: float) -> int:
    """Knuth's method; fine for the small rates used here."""
    if rate <= 0:
        return 0
    limit, count, product = math.exp(-rate), 0, rng.random()
    while product > limit:
        count += 1
        product *= rng.random()
    return count


def pseudo_centroid(barangay: str) -> tuple[float, float]:
    """An invented, stable position for a barangay (NOT its real location)."""
    digest = hashlib.sha256(barangay.encode()).digest()
    lat = 9.72 + (digest[0] / 255) * 0.16
    frac = digest[1] / 255
    if barangay in UPLAND:
        lng = 123.46 + frac * 0.04
    elif barangay in COASTAL:
        lng = 123.53 + frac * 0.02
    else:
        lng = 123.50 + frac * 0.03
    return lat, lng


def _months(end: date, count: int) -> list[tuple[int, int]]:
    year, month = end.year, end.month
    months = []
    for _ in range(count):
        months.append((year, month))
        year, month = (year, month - 1) if month > 1 else (year - 1, 12)
    return list(reversed(months))


def generate_demo_history(
    lookups: Lookups,
    barangays: list[str],
    *,
    end: date,
    months: int = 24,
    seed: int = DEFAULT_SEED,
) -> list[RecordRow]:
    """Invented incident records for the `months` calendar months ending with `end`'s month."""
    rng = random.Random(seed)  # noqa: S311  (invented demo data, not security)
    upland = [b for b in UPLAND if b in barangays]
    coastal = [b for b in COASTAL if b in barangays]
    places = {"upland": upland, "coastal": coastal, "any": barangays}
    drafts: list[tuple[date, str, str]] = []  # (day, hazard, barangay)

    for year, month in _months(end, months):
        days_in_month = ((date(year + month // 12, month % 12 + 1, 1)) - timedelta(days=1)).day
        last_day = min(days_in_month, end.day) if (year, month) == (end.year, end.month) else None
        last_day = last_day or days_in_month
        for hazard in HAZARDS:
            for _ in range(_poisson(rng, hazard.monthly[month - 1])):
                day = date(year, month, rng.randint(1, last_day))
                drafts.append((day, hazard.code, rng.choice(places[hazard.places])))
                if hazard.code == "typhoon":
                    # A typhoon usually brings several related incidents within a day or two.
                    for follow in rng.sample(TYPHOON_FOLLOW_UPS, rng.randint(2, 4)):
                        when = min(day + timedelta(days=rng.randint(0, 1)), end)
                        drafts.append((when, follow, rng.choice(places[_BY_CODE[follow].places])))

    rows: list[RecordRow] = []
    for number, (day, code, barangay) in enumerate(sorted(drafts), start=1):
        hazard = _BY_CODE[code]
        incident_time = None
        if rng.random() > 0.15:  # some records in the files have no time
            incident_time = time(rng.choice(hazard.peak_hours), rng.choice(range(0, 60, 5)))
        latitude = longitude = None
        if rng.random() > 0.2:  # and some have no coordinates
            lat, lng = pseudo_centroid(barangay)
            latitude = Decimal(f"{lat + rng.uniform(-0.004, 0.004):.6f}")
            longitude = Decimal(f"{lng + rng.uniform(-0.004, 0.004):.6f}")
        rows.append(
            RecordRow(
                row_number=number + 1,
                incident_date=day,
                incident_time=incident_time,
                hazard_code=code,
                other_hazard_text="Sinkhole" if code == "other" else None,
                barangay_id=lookups.barangays[name_key(barangay)],
                description=f"DEMO DATA: {rng.choice(hazard.descriptions)}",
                landmark=None,
                latitude=latitude,
                longitude=longitude,
                status=ReportStatus.RESOLVED if rng.random() > 0.1 else ReportStatus.VERIFIED,
                external_ref=f"DEMO-{day.year}-{number:04d}",
            )
        )
    return rows
