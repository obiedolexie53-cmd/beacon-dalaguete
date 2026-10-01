"""Fictional DEMO reports for development and evaluation walkthroughs.

These are not real incidents. Every record is saved with is_demo = True and its
description starts with "DEMO DATA". Coordinates are approximate demo points
inside Dalaguete, not real incident locations.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.reports.workflow import ReportStatus as S

MANILA = ZoneInfo("Asia/Manila")


@dataclass(frozen=True)
class DemoReport:
    sequence: int  # BEA-2026-<sequence>
    hazard_code: str
    barangay: str
    description: str
    landmark: str
    incident_date: date
    incident_time: time
    submitted_at: datetime
    latitude: Decimal
    longitude: Decimal
    # Status changes made by MDRRMO staff after the initial "submitted" entry: (status, note)
    history: list[tuple[S, str]] = field(default_factory=list)


DEMO_REPORTS: list[DemoReport] = [
    DemoReport(
        sequence=123,
        hazard_code="landslide",
        barangay="Mantalongon",
        description=(
            "DEMO DATA: Soil and rocks slid onto the barangay road after continuous rain. "
            "The road is partly blocked. No injuries seen."
        ),
        landmark="Near the barangay hall road junction",
        incident_date=date(2026, 9, 28),
        incident_time=time(16, 35),
        submitted_at=datetime(2026, 9, 28, 16, 52, tzinfo=MANILA),
        latitude=Decimal("9.841200"),
        longitude=Decimal("123.487300"),
        history=[(S.UNDER_VERIFICATION, "DEMO: Forwarded to field team for validation.")],
    ),
    DemoReport(
        sequence=87,
        hazard_code="heavy_rainfall",
        barangay="Mantalongon",
        description="DEMO DATA: Heavy rain for several hours; water flowing across the road.",
        landmark="Upper sitio access road",
        incident_date=date(2026, 8, 14),
        incident_time=time(14, 10),
        submitted_at=datetime(2026, 8, 14, 14, 25, tzinfo=MANILA),
        latitude=Decimal("9.838900"),
        longitude=Decimal("123.491000"),
        history=[
            (S.UNDER_VERIFICATION, "DEMO: Checking with barangay officials."),
            (S.VERIFIED, "DEMO: Confirmed by barangay tanod."),
            (S.RESOLVED, "DEMO: Road cleared; drainage checked."),
        ],
    ),
]
