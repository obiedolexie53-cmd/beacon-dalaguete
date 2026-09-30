import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class MediaKind(StrEnum):
    PHOTO = "photo"
    VIDEO = "video"


class ReportMedia(Base):
    """Photo/video evidence. Files live in private storage; never publicly addressable."""

    __tablename__ = "report_media"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reports.id", ondelete="CASCADE"), index=True
    )
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[MediaKind] = mapped_column(
        Enum(MediaKind, name="media_kind", values_callable=lambda e: [m.value for m in e])
    )
    storage_key: Mapped[str] = mapped_column(String(200), unique=True)
    mime_type: Mapped[str] = mapped_column(String(50))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
