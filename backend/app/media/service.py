"""Attaching evidence to a resident's report."""

import hashlib
import logging
import uuid
from pathlib import Path
from typing import BinaryIO

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audit.service import record
from app.core.config import get_settings
from app.core.errors import ApiError
from app.media import video
from app.media.limits import (
    MAX_PHOTO_BYTES,
    MAX_PHOTOS_PER_REPORT,
    MAX_VIDEO_BYTES,
    MAX_VIDEOS_PER_REPORT,
)
from app.media.processing import InvalidMediaError, detect_kind, process_photo, process_video
from app.media.storage import LocalMediaStorage
from app.models import MediaKind, Report, ReportMedia, User
from app.reports.workflow import ReportStatus

logger = logging.getLogger(__name__)

# Evidence can be added until MDRRMO personnel have verified or resolved the report.
OPEN_FOR_EVIDENCE = frozenset(
    {ReportStatus.SUBMITTED, ReportStatus.UNDER_VERIFICATION, ReportStatus.NEEDS_CLARIFICATION}
)
LIMITS = {
    MediaKind.PHOTO: (MAX_PHOTOS_PER_REPORT, MAX_PHOTO_BYTES, "photos"),
    MediaKind.VIDEO: (MAX_VIDEOS_PER_REPORT, MAX_VIDEO_BYTES, "videos"),
}

REPORT_NOT_FOUND = ApiError(status.HTTP_404_NOT_FOUND, "not_found", "Report not found.")


def get_own_report(db: Session, reporter: User, reference_no: str) -> Report:
    """A resident's own report. Anyone else's report is simply 'not found'."""
    report = db.scalar(
        select(Report).where(Report.reference_no == reference_no, Report.reporter_id == reporter.id)
    )
    if report is None:
        raise REPORT_NOT_FOUND
    return report


def active_media(db: Session, report: Report) -> list[ReportMedia]:
    return list(
        db.scalars(
            select(ReportMedia)
            .where(ReportMedia.report_id == report.id, ReportMedia.removed_at.is_(None))
            .order_by(ReportMedia.uploaded_at)
        )
    )


def add_evidence(
    db: Session,
    storage: LocalMediaStorage,
    reporter: User,
    reference_no: str,
    upload: BinaryIO,
    ip: str | None,
) -> ReportMedia:
    report = get_own_report(db, reporter, reference_no)
    if report.status not in OPEN_FOR_EVIDENCE:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "evidence_closed",
            "Evidence can no longer be added to this report.",
        )

    upload.seek(0, 2)
    size = upload.tell()
    upload.seek(0)
    kind = detect_kind(upload.read(16))
    upload.seek(0)
    if kind is None:
        raise ApiError(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "unsupported_media",
            "Use a JPEG, PNG or WebP photo, or an MP4, MOV or WebM video.",
        )

    max_count, max_bytes, label = LIMITS[kind]
    if size == 0 or size > max_bytes:
        raise ApiError(
            status.HTTP_413_CONTENT_TOO_LARGE,
            "file_too_large",
            f"This file is too large. {label.capitalize()} can be up to "
            f"{max_bytes // (1024 * 1024)} MB.",
        )
    existing = db.scalar(
        select(func.count())
        .select_from(ReportMedia)
        .where(
            ReportMedia.report_id == report.id,
            ReportMedia.kind == kind,
            ReportMedia.removed_at.is_(None),
        )
    )
    if existing >= max_count:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "too_many_files",
            f"A report can have up to {max_count} {label}.",
        )

    try:
        if kind is MediaKind.PHOTO:
            processed = process_photo(upload.read())
        else:
            processed = process_video(upload.read(16))
            upload.seek(0)
    except InvalidMediaError as exc:
        raise ApiError(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "unsupported_media", str(exc)
        ) from exc

    media_id = uuid.uuid4()
    key = f"reports/{report.id}/{media_id}.{processed.extension}"
    width, height = processed.width, processed.height
    if kind is MediaKind.PHOTO:
        storage.save(key, processed.data)
        sha256 = hashlib.sha256(processed.data).hexdigest()
        stored_size = len(processed.data)
    else:
        sha256, stored_size, width, height = _store_video(
            storage, key, upload, processed.extension, size
        )

    media = ReportMedia(
        id=media_id,
        report_id=report.id,
        uploaded_by_id=reporter.id,
        kind=kind,
        storage_key=key,
        mime_type=processed.mime_type,
        size_bytes=stored_size,
        width=width,
        height=height,
        sha256=sha256,
    )
    db.add(media)
    record(
        db,
        "report.media_added",
        actor_id=reporter.id,
        ip=ip,
        entity="report",
        entity_id=report.reference_no,
        details={"media_id": str(media_id), "kind": kind.value},
    )
    try:
        db.commit()
    except Exception:
        storage.delete(key)
        raise
    db.refresh(media)
    return media


VIDEO_UNAVAILABLE = ApiError(
    status.HTTP_503_SERVICE_UNAVAILABLE,
    "video_unavailable",
    "Videos cannot be added right now. Add photos instead, or try again later.",
)


def _store_video(
    storage: LocalMediaStorage, key: str, upload: BinaryIO, extension: str, size: int
) -> tuple[str, int, int | None, int | None]:
    """Store a video with its metadata (including location) removed."""
    if not video.tools_available():
        if get_settings().environment == "production":
            raise VIDEO_UNAVAILABLE
        # Development without ffmpeg: keep the file as uploaded.
        logger.warning("ffmpeg not found; storing video %s without removing metadata", key)
        return storage.save_stream(key, upload), size, None, None
    with video.temporary_workdir() as workdir:
        try:
            clean = video.clean_video(upload, extension, Path(workdir))
        except InvalidMediaError as exc:
            raise ApiError(
                status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "unsupported_media", str(exc)
            ) from exc
        with clean.path.open("rb") as cleaned:
            sha256 = storage.save_stream(key, cleaned)
        return sha256, clean.path.stat().st_size, clean.width, clean.height
