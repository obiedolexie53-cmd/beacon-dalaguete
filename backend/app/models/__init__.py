"""SQLAlchemy models. Importing this package registers every table on Base.metadata."""

from app.models.audit import AuditLog
from app.models.location import Barangay
from app.models.media import MediaKind, ReportMedia
from app.models.notification import Notification
from app.models.report import (
    HazardType,
    ImportBatch,
    LocationSource,
    Report,
    ReportSequence,
    ReportSource,
    ReportStatusHistory,
)
from app.models.user import RefreshToken, User, UserRole

__all__ = [
    "AuditLog",
    "Barangay",
    "HazardType",
    "ImportBatch",
    "LocationSource",
    "MediaKind",
    "Notification",
    "RefreshToken",
    "Report",
    "ReportMedia",
    "ReportSequence",
    "ReportSource",
    "ReportStatusHistory",
    "User",
    "UserRole",
]
