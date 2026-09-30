from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

from app.analysis.schemas import AnalysisFiltersOut

TrendDirection = Literal["increasing", "decreasing", "no_clear_trend", "insufficient_data"]
FindingKind = Literal["recurrence", "hotspot", "seasonality", "trend", "co_occurrence"]


class PatternParameters(BaseModel):
    hotspot_distance_m: int
    hotspot_min_records: int
    recurrence_min_records: int
    co_occurrence_days: int


class PatternDataset(BaseModel):
    total: int
    with_coordinates: int
    first_incident: date | None
    last_incident: date | None
    months_covered: int
    #: False when there are too few records for pattern identification.
    sufficient: bool


class NamedRef(BaseModel):
    code: str
    name: str


class Finding(BaseModel):
    """A plain-language, descriptive statement about the recorded dataset."""

    kind: FindingKind
    hazard: str | None
    text: str


class RecurrenceOut(BaseModel):
    hazard: NamedRef
    barangay_id: int
    barangay: str
    count: int
    months_with_records: int
    years_with_records: int
    first: date
    last: date
    share_of_hazard: float


class HotspotOut(BaseModel):
    id: str
    hazard: NamedRef
    count: int
    center_latitude: float
    center_longitude: float
    radius_m: int
    barangays: list[str]
    first: date
    last: date
    reference_nos: list[str]


class SeasonalityOut(BaseModel):
    hazard: NamedRef
    total: int
    monthly: list[int]
    peak_months: list[int]
    p_value: float | None
    concentrated: bool


class TrendOut(BaseModel):
    hazard: NamedRef | None
    total: int
    months: int
    change_per_year: float | None
    tau: float | None
    p_value: float | None
    direction: TrendDirection


class CoOccurrenceOut(BaseModel):
    hazard: NamedRef
    with_hazard: NamedRef
    count: int
    share: float
    lift: float | None


class PatternAnalysis(BaseModel):
    """4.2 Hazard Pattern Identification. Describes recorded data; it does not predict."""

    filters: AnalysisFiltersOut
    parameters: PatternParameters
    dataset: PatternDataset
    findings: list[Finding]
    recurring_locations: list[RecurrenceOut]
    hotspots: list[HotspotOut]
    seasonality: list[SeasonalityOut]
    trends: list[TrendOut]
    co_occurrence: list[CoOccurrenceOut]
    generated_at: datetime
