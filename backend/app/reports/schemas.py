import uuid
from datetime import date, datetime, time
from decimal import Decimal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationInfo,
    field_validator,
    model_validator,
)

from app.auth.schemas import BarangayOut
from app.models import LocationSource
from app.reports.validation import (
    DESCRIPTION_MAX,
    DESCRIPTION_MIN,
    LANDMARK_MAX,
    LANDMARK_MIN,
    OTHER_HAZARD_MAX,
    check_incident_date,
    check_incident_time,
    in_service_area,
)
from app.reports.workflow import ReportStatus


class HazardTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str


class ReportSummary(BaseModel):
    """What a resident sees in lists and on the dashboard."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reference_no: str
    hazard_type: HazardTypeOut
    other_hazard_text: str | None
    barangay: BarangayOut | None
    incident_date: date
    incident_time: time | None
    status: ReportStatus
    submitted_at: datetime
    is_demo: bool


class StatusCounts(BaseModel):
    total: int = 0
    submitted: int = 0
    under_verification: int = 0
    needs_clarification: int = 0
    verified: int = 0
    resolved: int = 0


class ResidentDashboard(BaseModel):
    counts: StatusCounts
    recent_reports: list[ReportSummary]


class ReportPage(BaseModel):
    items: list[ReportSummary]
    total: int


class ReportCreate(BaseModel):
    """A resident's new report. Status, reporter and reference number are set by the server."""

    client_request_id: uuid.UUID
    hazard_type_id: int
    other_hazard_text: str | None = Field(default=None, max_length=OTHER_HAZARD_MAX)
    description: str
    incident_date: date
    incident_time: time | None = None
    barangay_id: int
    latitude: Decimal | None = Field(default=None, ge=-90, le=90, decimal_places=6)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180, decimal_places=6)
    location_accuracy_m: int | None = Field(default=None, ge=0, le=100_000)
    location_source: LocationSource | None = None
    # Declared after the coordinates so its validator can see them.
    landmark: str | None = Field(default=None, max_length=LANDMARK_MAX, validate_default=True)

    @field_validator("description")
    @classmethod
    def _description(cls, value: str) -> str:
        value = value.strip()
        if len(value) < DESCRIPTION_MIN:
            raise ValueError(f"Describe what happened in at least {DESCRIPTION_MIN} characters")
        if len(value) > DESCRIPTION_MAX:
            raise ValueError(f"Keep the description under {DESCRIPTION_MAX} characters")
        return value

    @field_validator("other_hazard_text")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return " ".join(value.split()) or None if value else None

    @field_validator("longitude")
    @classmethod
    def _inside_dalaguete(cls, value: Decimal | None, info: ValidationInfo) -> Decimal | None:
        latitude = info.data.get("latitude")
        if value is not None and latitude is not None:
            if not in_service_area(float(latitude), float(value)):
                raise ValueError("The location appears to be outside Dalaguete")
        return value

    @field_validator("landmark")
    @classmethod
    def _landmark(cls, value: str | None, info: ValidationInfo) -> str | None:
        value = " ".join(value.split()) or None if value else None
        # Without a map position, a landmark is how responders find the place.
        has_coordinates = info.data.get("latitude") is not None
        coordinates_valid = "latitude" in info.data and "longitude" in info.data
        if coordinates_valid and not has_coordinates and (not value or len(value) < LANDMARK_MIN):
            raise ValueError("Add a nearby landmark, or set the location on the map")
        return value

    @field_validator("incident_date")
    @classmethod
    def _incident_date(cls, value: date) -> date:
        check_incident_date(value)
        return value

    @field_validator("incident_time")
    @classmethod
    def _incident_time(cls, value: time | None, info: ValidationInfo) -> time | None:
        if value is None:
            return None
        value = value.replace(second=0, microsecond=0)
        if (incident_date := info.data.get("incident_date")) is not None:
            check_incident_time(incident_date, value)
        return value

    @model_validator(mode="after")
    def _coordinates_pair(self) -> "ReportCreate":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Provide both latitude and longitude, or neither")
        return self
