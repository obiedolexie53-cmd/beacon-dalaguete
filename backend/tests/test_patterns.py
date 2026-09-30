import re
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.cli import seed_demo_history
from app.models import UserRole
from app.patterns.methods import (
    Incident,
    co_occurrence,
    hotspots,
    recurring_locations,
    seasonality,
    trends,
)
from tests.factories import PASSWORD, make_user

START = date(2024, 1, 1)


def inc(n, day, hazard="landslide", barangay=1, lat=None, lng=None) -> Incident:
    return Incident(f"R{n}", day, hazard, barangay, lat, lng)


def test_recurrence_needs_repeat_records_in_different_months() -> None:
    items = [
        inc(1, date(2024, 9, 1)),
        inc(2, date(2024, 10, 5)),
        inc(3, date(2025, 9, 9)),
        inc(4, date(2024, 9, 1), barangay=2),  # three records, but all in one month
        inc(5, date(2024, 9, 2), barangay=2),
        inc(6, date(2024, 9, 3), barangay=2),
        inc(7, date(2024, 9, 3), hazard="flood"),
    ]
    found = recurring_locations(items, min_records=3)
    assert [(r.hazard, r.barangay_id, r.count) for r in found] == [("landslide", 1, 3)]
    (r,) = found
    assert (r.months_with_records, r.years_with_records) == (3, 2)
    assert r.share_of_hazard == 0.5


def test_hotspots_cluster_nearby_records_of_one_hazard() -> None:
    near = [(9.8000, 123.4800), (9.8010, 123.4805), (9.8005, 123.4795), (9.8012, 123.4812)]
    items = [inc(i, START, lat=a, lng=b) for i, (a, b) in enumerate(near)]
    items.append(inc(9, START, lat=9.85, lng=123.53))  # 7 km away: noise
    items += [inc(20 + i, START, hazard="flood", lat=a, lng=b) for i, (a, b) in enumerate(near[:2])]
    items.append(inc(30, START))  # no coordinates
    (spot,) = hotspots(items, distance_m=300, min_records=3)
    assert spot.hazard == "landslide" and spot.count == 4
    assert spot.reference_nos == ("R0", "R1", "R2", "R3")
    assert 50 < spot.radius_m < 200
    assert abs(spot.center_latitude - 9.80068) < 0.0002
    # A smaller distance splits the group up: no cluster reaches 3 records.
    assert hotspots(items, distance_m=60, min_records=3) == []


def test_seasonality_finds_concentrated_months() -> None:
    items = []
    n = 0
    for year in (2024, 2025):
        for month in range(1, 13):
            count = 8 if month in (9, 10) else 1
            for k in range(count):
                n += 1
                items.append(inc(n, date(year, month, 1 + k)))
    (landslide,) = seasonality(items, date(2024, 1, 1), date(2025, 12, 31))
    assert landslide.concentrated and landslide.p_value is not None and landslide.p_value < 0.001
    assert landslide.peak_months == (9, 10)
    assert landslide.monthly[8] == 16

    even = [inc(i, date(2024, 1 + i % 12, 1)) for i in range(24)]
    (flat,) = seasonality(even, date(2024, 1, 1), date(2024, 12, 31))
    assert not flat.concentrated and flat.peak_months == ()
    (few,) = seasonality(even[:5], date(2024, 1, 1), date(2024, 12, 31))
    assert few.p_value is None


def test_trends() -> None:
    rising = []
    n = 0
    for i in range(24):
        month = date(2024 + i // 12, i % 12 + 1, 1)
        for _ in range(1 + i // 3):
            n += 1
            rising.append(inc(n, month))
    overall, landslide = trends(rising, date(2024, 1, 1), date(2025, 12, 31))
    assert overall.hazard is None and landslide.hazard == "landslide"
    assert landslide.direction == "increasing"
    assert landslide.change_per_year and landslide.change_per_year > 0
    steady = [inc(i, date(2024 + i // 12, i % 12 + 1, 1)) for i in range(24)]
    assert trends(steady, date(2024, 1, 1), date(2025, 12, 31))[0].direction == "no_clear_trend"
    short = trends(steady[:6], date(2024, 1, 1), date(2024, 6, 30))
    assert short[0].direction == "insufficient_data"


def test_co_occurrence_compares_with_the_same_month() -> None:
    items = []
    for k in range(6):
        day = date(2024, 8, 1) + timedelta(days=5 * k)
        items += [inc(2 * k, day, "typhoon"), inc(2 * k + 1, day + timedelta(days=1), "flood")]
    found = {(c.hazard, c.with_hazard): c for c in co_occurrence(items, START, date(2024, 12, 31))}
    pair = found[("typhoon", "flood")]
    assert pair.count == 6 and pair.share == 1.0
    assert pair.lift is not None and pair.lift > 1
    assert co_occurrence(items, START, date(2024, 12, 31), window_days=0) == []


# --- API ----------------------------------------------------------------------------------

URL = "/api/v1/staff/analysis/patterns"
FORWARD_LOOKING = re.compile(
    r"\b(will|would likely|likely to|predict\w*|forecast\w*|expected to)\b", re.I
)


@pytest.fixture
def staff(api: TestClient, db: Session) -> dict[str, str]:
    make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")
    token = api.post(
        "/api/v1/staff/auth/login",
        json={"identifier": "officer@example.gov.ph", "password": PASSWORD},
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.db
def test_patterns_on_demo_history_are_descriptive(api: TestClient, db: Session, staff) -> None:
    seed_demo_history(db, months=24, end=date(2026, 8, 31))
    body = api.get(URL, headers=staff).json()
    assert body["dataset"]["sufficient"] is True
    assert body["dataset"]["months_covered"] == 24
    kinds = {f["kind"] for f in body["findings"]}
    assert {"recurrence", "hotspot", "seasonality"} <= kinds
    assert body["findings"][0]["text"].startswith("Recurring ")
    assert "were identified in the recorded dataset" in body["findings"][0]["text"]
    for finding in body["findings"]:
        assert not FORWARD_LOOKING.search(finding["text"]), finding["text"]
    spot = body["hotspots"][0]
    assert spot["id"] == "H1" and spot["count"] >= 3 and spot["reference_nos"]
    assert body["parameters"] == {
        "hotspot_distance_m": 500,
        "hotspot_min_records": 3,
        "recurrence_min_records": 3,
        "co_occurrence_days": 2,
    }
    # Parameters and filters are applied.
    fewer = api.get(URL, params={"hotspot_min_records": 8}, headers=staff).json()
    assert all(h["count"] >= 8 for h in fewer["hotspots"])
    assert len(fewer["hotspots"]) < len(body["hotspots"])
    fire = api.get(URL, params={"hazard": "fire"}, headers=staff).json()
    assert {r["hazard"]["code"] for r in fire["recurring_locations"]} <= {"fire"}


@pytest.mark.db
def test_patterns_need_enough_records(api: TestClient, staff) -> None:
    body = api.get(URL, headers=staff).json()
    assert body["dataset"]["sufficient"] is False
    assert body["findings"] == [] and body["hotspots"] == []


@pytest.mark.db
def test_patterns_validate_parameters_and_access(api: TestClient, staff) -> None:
    assert api.get(URL, params={"hotspot_distance_m": 10}, headers=staff).status_code == 422
    assert api.get(URL, params={"co_occurrence_days": 30}, headers=staff).status_code == 422
    assert api.get(URL).status_code == 401
