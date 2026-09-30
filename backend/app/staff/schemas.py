import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.auth.schemas import BarangayOut
from app.media.schemas import MediaOut
from app.models import LocationSource, ReportSource
from app.reports.schemas import HazardTypeOut
from app.reports.workflow import ReportStatus


class StaffStatusCounts(BaseModel):
    total: int = 0
    #: Submitted and not yet picked up for verification.
    new: int = 0
    under_verification: int = 0
    needs_clarification: int = 0
    verified: int = 0
    resolved: int = 0


class StaffReportRow(BaseModel):
    """One row of the MDRRMO reports tables."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reference_no: str
    hazard_type: HazardTypeOut
    other_hazard_text: str | None
    barangay: BarangayOut | None
    incident_date: date
    incident_time: time | None
    submitted_at: datetime
    status: ReportStatus
    is_demo: bool
    #: "resident" (submitted in the app) or "import" (from MDRRMO records).
    source: ReportSource


class StaffDashboard(BaseModel):
    counts: StaffStatusCounts
    recent_reports: list[StaffReportRow]
    include_demo: bool
    generated_at: datetime


class StaffReportPage(BaseModel):
    items: list[StaffReportRow]
    total: int
    limit: int
    offset: int


class ReporterInfo(BaseModel):
    """Personal details shown to MDRRMO personnel for verification only."""

    id: uuid.UUID
    full_name: str
    email: str | None
    phone: str | None
    barangay: BarangayOut | None


class StaffTimelineEntry(BaseModel):
    status: ReportStatus
    changed_at: datetime
    by_role: Literal["resident", "mdrrmo"]
    actor_name: str | None
    note: str | None


class StaffReportDetail(StaffReportRow):
    description: str
    municipality: str
    province: str
    landmark: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    location_accuracy_m: int | None
    location_source: LocationSource | None
    #: None for records imported from MDRRMO files, which have no BEACON reporter.
    reporter: ReporterInfo | None
    #: Record number in the original MDRRMO file, if it had one.
    external_ref: str | None
    import_filename: str | None
    timeline: list[StaffTimelineEntry]
    media: list[MediaOut]
    verified_at: datetime | None
    verified_by: str | None
    verification_notes: str | None
    resolved_at: datetime | None
    resolved_by: str | None
    resolution_notes: str | None
    #: Statuses this report can move to next (drives the action buttons).
    allowed_actions: list[ReportStatus]


class StatusChangeRequest(BaseModel):
    status: ReportStatus
    #: The status the officer saw; if it changed meanwhile, the update is refused.
    from_status: ReportStatus
    note: str | None = Field(default=None, max_length=1000)


class MapPoint(BaseModel):
    """One report on the disaster map (no personal details)."""

    model_config = ConfigDict(from_attributes=True)

    reference_no: str
    latitude: Decimal
    longitude: Decimal
    location_accuracy_m: int | None
    hazard_type: HazardTypeOut
    other_hazard_text: str | None
    barangay: BarangayOut | None
    landmark: str | None
    incident_date: date
    incident_time: time | None
    status: ReportStatus
    is_demo: bool
    source: ReportSource


class MapData(BaseModel):
    points: list[MapPoint]
    #: Matching reports that have no coordinates (landmark only).
    without_location: int
    #: True when more points matched than MAP_POINT_LIMIT and the rest were left out.
    truncated: bool
