import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.auth.deps import CurrentResident, DbSession
from app.models import Report
from app.notifications.service import list_notifications, mark_read, unread_count

router = APIRouter(prefix="/me/notifications", tags=["resident"])


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: str
    title: str
    body: str
    report_reference_no: str | None
    read: bool
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread: int


class UnreadCount(BaseModel):
    unread: int


@router.get("", response_model=NotificationList)
def my_notifications(
    user: CurrentResident, db: DbSession, limit: Annotated[int, Query(ge=1, le=100)] = 50
) -> NotificationList:
    items = list_notifications(db, user.id, limit)
    report_ids = {n.report_id for n in items if n.report_id}
    references = (
        dict(
            db.execute(
                select(Report.id, Report.reference_no).where(Report.id.in_(report_ids))
            ).all()
        )
        if report_ids
        else {}
    )
    return NotificationList(
        items=[
            NotificationOut(
                id=n.id,
                kind=n.kind,
                title=n.title,
                body=n.body,
                report_reference_no=references.get(n.report_id),
                read=n.read_at is not None,
                created_at=n.created_at,
            )
            for n in items
        ],
        unread=unread_count(db, user.id),
    )


@router.get("/unread-count", response_model=UnreadCount)
def my_unread_count(user: CurrentResident, db: DbSession) -> UnreadCount:
    """Cheap endpoint for the navigation badge (polled by the app)."""
    return UnreadCount(unread=unread_count(db, user.id))


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def read_all(user: CurrentResident, db: DbSession) -> None:
    mark_read(db, user.id)


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def read_one(notification_id: uuid.UUID, user: CurrentResident, db: DbSession) -> None:
    mark_read(db, user.id, notification_id)
