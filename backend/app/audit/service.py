import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog


def record(
    db: Session,
    action: str,
    *,
    actor_id: uuid.UUID | None = None,
    ip: str | None = None,
    entity: str | None = None,
    entity_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Add an audit entry to the current transaction (committed with the caller's work)."""
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            ip=ip,
            entity=entity,
            entity_id=entity_id,
            details=details,
        )
    )
