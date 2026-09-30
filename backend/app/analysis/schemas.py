from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.models import ReportSource
from app.reports.workflow import ReportStatus

#: "confirmed" = reports MDRRMO personnel verified or resolved (the default);
#: "all" = every recorded report, including ones not yet verified.
AnalysisScope = Literal["confirmed", "all"]


class AnalysisFiltersOut(BaseModel):
    scope: AnalysisScope
    statuses: list[ReportStatus]
    hazard: str | None
    barangay_id: int | None
    source: ReportSource | None
    date_from: date | None
    date_to: date | None
    include_demo: bool


class DatasetSummary(BaseModel):
    total: int
    from_app: int
    imported: int
    demo: int
    with_coordinates: int
    with_time: int
    first_incident: date | None
    last_incident: date | None


class HazardCount(BaseModel):
    code: str
    name: str
    count: int
    #: Share of all records in the dataset (0–1).
    share: float


class BarangayCount(BaseModel):
    id: int
    name: str
    count: int
    share: float
    #: The hazard type recorded most often in this barangay (ties: alphabetical).
    top_hazard: str
    top_hazard_count: int


class PeriodCount(BaseModel):
    #: "YYYY-MM"
    month: str
    count: int


class IndexedCount(BaseModel):
    #: Month of year 1–12, hour 0–23 or ISO weekday 1 (Monday)–7 (Sunday).
    key: int
    count: int


class HazardBarangayCount(BaseModel):
    hazard: str
    barangay_id: int
    count: int


class HazardMonthCount(BaseModel):
    hazard: str
    month_of_year: int
    count: int


class IncidentAnalysis(BaseModel):
    """Descriptive counts of recorded incidents (4.1 Incident Data Analysis).

    Describes what is in the recorded dataset; it does not predict future events.
    """

    filters: AnalysisFiltersOut
    dataset: DatasetSummary
    by_hazard: list[HazardCount]
    by_barangay: list[BarangayCount]
    without_barangay: int
    #: Every month from the first to the last in the period, including months with none.
    by_month: list[PeriodCount]
    by_month_of_year: list[IndexedCount]
    by_hour: list[IndexedCount]
    unknown_time: int
    by_weekday: list[IndexedCount]
    hazard_by_barangay: list[HazardBarangayCount]
    hazard_by_month_of_year: list[HazardMonthCount]
    generated_at: datetime
