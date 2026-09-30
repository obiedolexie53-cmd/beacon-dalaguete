import uuid
from datetime import datetime

from pydantic import BaseModel

from app.media.signing import signed_media_url
from app.models import MediaKind, ReportMedia


class MediaOut(BaseModel):
    id: uuid.UUID
    kind: MediaKind
    mime_type: str
    size_bytes: int
    width: int | None
    height: int | None
    uploaded_at: datetime
    #: Short-lived signed link for <img>/<video>; request the list again for a fresh one.
    url: str

    @classmethod
    def from_model(cls, media: ReportMedia) -> "MediaOut":
        return cls(
            id=media.id,
            kind=media.kind,
            mime_type=media.mime_type,
            size_bytes=media.size_bytes,
            width=media.width,
            height=media.height,
            uploaded_at=media.uploaded_at,
            url=signed_media_url(media.id),
        )
