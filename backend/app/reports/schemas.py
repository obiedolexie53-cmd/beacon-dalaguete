import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict

from app.auth.schemas import BarangayOut
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
