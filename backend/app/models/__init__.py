"""SQLAlchemy models. Importing this package registers every table on Base.metadata."""

from app.models.audit import AuditLog
from app.models.location import Barangay
from app.models.media import MediaKind, ReportMedia
from app.models.report import (
    HazardType,
    LocationSource,
    Report,
    ReportSequence,
    ReportStatusHistory,
)
from app.models.user import RefreshToken, User, UserRole

__all__ = [
    "AuditLog",
    "Barangay",
    "HazardType",
    "LocationSource",
    "MediaKind",
    "RefreshToken",
    "Report",
    "ReportMedia",
    "ReportSequence",
    "ReportStatusHistory",
    "User",
    "UserRole",
]
