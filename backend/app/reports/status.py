"""Changing a report's status. Used by the MDRRMO verification screens (Phase 10).

Only authorized MDRRMO personnel can change a status, only along the allowed
workflow, and every change is kept in the report's history and sent to the
reporter as a notification.
"""

from datetime import UTC, datetime

from fastapi import status as http
from sqlalchemy.orm import Session

from app.audit.service import record
from app.core.errors import ApiError
from app.models import Report, ReportStatusHistory, User
from app.notifications.service import notify_status_change
from app.reports.workflow import STATUS_LABELS, ReportStatus, can_transition

NOTE_MAX = 1000


def change_status(
    db: Session,
    report: Report,
    target: ReportStatus,
    actor: User,
    note: str | None = None,
    ip: str | None = None,
) -> Report:
    if not actor.is_staff:
        raise ApiError(http.HTTP_403_FORBIDDEN, "forbidden", "Only MDRRMO personnel can do this.")
    current = report.status
    if not can_transition(current, target):
        raise ApiError(
            http.HTTP_409_CONFLICT,
            "invalid_transition",
            f"A report that is {STATUS_LABELS[current]} cannot be changed to "
            f"{STATUS_LABELS[target]}.",
        )
    note = " ".join(note.split()) if note else None
    if note and len(note) > NOTE_MAX:
        raise ApiError(
            http.HTTP_422_UNPROCESSABLE_CONTENT,
            "validation_error",
            "Please check the highlighted fields.",
            {"note": f"Keep the note under {NOTE_MAX} characters"},
        )
    if target is ReportStatus.NEEDS_CLARIFICATION and not note:
        raise ApiError(
            http.HTTP_422_UNPROCESSABLE_CONTENT,
            "validation_error",
            "Please check the highlighted fields.",
            {"note": "Tell the resident what information is needed"},
        )

    now = datetime.now(UTC)
    report.status = target
    if target is ReportStatus.VERIFIED:
        report.verified_by_id, report.verified_at, report.verification_notes = actor.id, now, note
    elif target is ReportStatus.RESOLVED:
        report.resolved_by_id, report.resolved_at, report.resolution_notes = actor.id, now, note
    db.add(
        ReportStatusHistory(
            report_id=report.id,
            from_status=current,
            to_status=target,
            changed_by_id=actor.id,
            note=note,
            changed_at=now,
        )
    )
    notify_status_change(db, report, target, note)
    record(
        db,
        "report.status_changed",
        actor_id=actor.id,
        ip=ip,
        entity="report",
        entity_id=report.reference_no,
        details={"from": current.value, "to": target.value},
    )
    db.commit()
    db.refresh(report)
    return report
