import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.auth.deps import CurrentResident, DbSession, client_ip
from app.core.errors import ApiError
from app.media.schemas import MediaOut
from app.media.service import active_media, add_evidence, get_own_report
from app.media.signing import verify_media_signature
from app.media.storage import get_storage
from app.models import ReportMedia

resident_router = APIRouter(prefix="/me/reports/{reference_no}/media", tags=["resident"])
public_router = APIRouter(tags=["media"])

MEDIA_NOT_FOUND = ApiError(status.HTTP_404_NOT_FOUND, "not_found", "File not found.")


@resident_router.post("", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
def upload_evidence(
    reference_no: str, file: UploadFile, user: CurrentResident, db: DbSession, request: Request
) -> MediaOut:
    """Attach one photo or video to the resident's own report."""
    media = add_evidence(db, get_storage(), user, reference_no, file.file, client_ip(request))
    return MediaOut.from_model(media)


@resident_router.get("", response_model=list[MediaOut])
def list_evidence(reference_no: str, user: CurrentResident, db: DbSession) -> list[MediaOut]:
    report = get_own_report(db, user, reference_no)
    return [MediaOut.from_model(m) for m in active_media(db, report)]


@public_router.get("/media/{media_id}", response_class=FileResponse)
def get_media_file(
    media_id: uuid.UUID,
    db: DbSession,
    exp: Annotated[int, Query()],
    sig: Annotated[str, Query(max_length=100)],
) -> FileResponse:
    """Serve one evidence file for a valid, unexpired signed link. Supports range requests."""
    if not verify_media_signature(media_id, exp, sig):
        raise MEDIA_NOT_FOUND
    media = db.scalar(
        select(ReportMedia).where(ReportMedia.id == media_id, ReportMedia.removed_at.is_(None))
    )
    path = get_storage().path(media.storage_key) if media else None
    if media is None or path is None or not path.is_file():
        raise MEDIA_NOT_FOUND
    return FileResponse(
        path,
        media_type=media.mime_type,
        content_disposition_type="inline",
        headers={
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        },
    )
