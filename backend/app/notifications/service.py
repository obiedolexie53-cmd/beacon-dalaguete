"""In-app notifications. Messages are written for residents in plain language."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import Notification, Report
from app.reports.workflow import ReportStatus

STATUS_MESSAGES: dict[ReportStatus, tuple[str, str]] = {
    ReportStatus.UNDER_VERIFICATION: (
        "Your report is being verified",
        "MDRRMO personnel are now reviewing report {ref}.",
    ),
    ReportStatus.NEEDS_CLARIFICATION: (
        "More information needed",
        "MDRRMO personnel need more information about report {ref}.",
    ),
    ReportStatus.VERIFIED: (
        "Report verified",
        "MDRRMO personnel have verified report {ref}.",
    ),
    ReportStatus.RESOLVED: (
        "Report resolved",
        "Report {ref} has been marked as resolved.",
    ),
}


def notify(
    db: Session, user_id: uuid.UUID, report: Report | None, kind: str, title: str, body: str
):
    db.add(
        Notification(
            user_id=user_id,
            report_id=report.id if report else None,
            kind=kind,
            title=title,
            body=body,
        )
    )


def notify_submitted(db: Session, report: Report) -> None:
    notify(
        db,
        report.reporter_id,
        report,
        "report_submitted",
        "Report received",
        f"Report {report.reference_no} was submitted. MDRRMO personnel will review it.",
    )


def notify_status_change(db: Session, report: Report, status: ReportStatus, note: str | None):
    title, body = STATUS_MESSAGES[status]
    text = body.format(ref=report.reference_no)
    if note:
        text += f' Note from MDRRMO: "{note}"'
    notify(db, report.reporter_id, report, f"status_{status.value}", title, text)


def list_notifications(db: Session, user_id: uuid.UUID, limit: int) -> list[Notification]:
    return list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
    )


def unread_count(db: Session, user_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        )
        or 0
    )


def mark_read(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID | None = None) -> None:
    """Mark one notification (or all, if no id) as read. Only the owner's rows are touched."""
    stmt = update(Notification).where(
        Notification.user_id == user_id, Notification.read_at.is_(None)
    )
    if notification_id is not None:
        stmt = stmt.where(Notification.id == notification_id)
    db.execute(stmt.values(read_at=datetime.now(UTC)))
    db.commit()
