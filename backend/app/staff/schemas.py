import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict

from app.auth.schemas import BarangayOut
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


class StaffDashboard(BaseModel):
    counts: StaffStatusCounts
    recent_reports: list[StaffReportRow]
    include_demo: bool
    generated_at: datetime
