"""Validate and clean uploaded evidence.

The file's real type is detected from its contents; the name and the
browser-supplied content type are ignored. Photos are re-encoded as JPEG, which
applies the camera orientation and drops all metadata (EXIF, including GPS).
"""

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from app.media.limits import MAX_PHOTO_PIXELS, STORED_PHOTO_MAX_SIDE
from app.models import MediaKind

Image.MAX_IMAGE_PIXELS = MAX_PHOTO_PIXELS

ACCEPTED_PHOTO_FORMATS = {"JPEG", "PNG", "WEBP"}


class InvalidMediaError(ValueError):
    pass


@dataclass(frozen=True)
class ProcessedMedia:
    kind: MediaKind
    data: bytes
    mime_type: str
    extension: str
    width: int | None = None
    height: int | None = None


def detect_kind(head: bytes) -> MediaKind | None:
    if head.startswith(b"\xff\xd8\xff") or head.startswith(b"\x89PNG\r\n\x1a\n"):
        return MediaKind.PHOTO
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return MediaKind.PHOTO
    if head[4:8] == b"ftyp" or head.startswith(b"\x1a\x45\xdf\xa3"):
        return MediaKind.VIDEO
    return None


def process_photo(data: bytes) -> ProcessedMedia:
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in ACCEPTED_PHOTO_FORMATS:
                raise InvalidMediaError("Use a JPEG, PNG or WebP photo")
            probe.verify()
        with Image.open(io.BytesIO(data)) as image:
            image = ImageOps.exif_transpose(image)
            if image.mode in ("RGBA", "LA", "P"):
                image = image.convert("RGBA")
                background = Image.new("RGB", image.size, (255, 255, 255))
                background.paste(image, mask=image.getchannel("A"))
                image = background
            elif image.mode != "RGB":
                image = image.convert("RGB")
            image.thumbnail((STORED_PHOTO_MAX_SIDE, STORED_PHOTO_MAX_SIDE))
            out = io.BytesIO()
            # A fresh save without exif=/icc_profile= carries no metadata.
            image.save(out, format="JPEG", quality=88, optimize=True)
            width, height = image.size
    except Image.DecompressionBombError as exc:
        raise InvalidMediaError("This photo is too large to process") from exc
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise InvalidMediaError("This photo could not be read. It may be damaged.") from exc
    return ProcessedMedia(
        kind=MediaKind.PHOTO,
        data=out.getvalue(),
        mime_type="image/jpeg",
        extension="jpg",
        width=width,
        height=height,
    )


def process_video(data: bytes) -> ProcessedMedia:
    """Identify the container from its first bytes (metadata is removed in media.video)."""
    if data.startswith(b"\x1a\x45\xdf\xa3"):
        return ProcessedMedia(MediaKind.VIDEO, data, "video/webm", "webm")
    if data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand == b"qt  ":
            return ProcessedMedia(MediaKind.VIDEO, data, "video/quicktime", "mov")
        if brand.startswith(b"3g"):
            return ProcessedMedia(MediaKind.VIDEO, data, "video/3gpp", "3gp")
        return ProcessedMedia(MediaKind.VIDEO, data, "video/mp4", "mp4")
    raise InvalidMediaError("Use an MP4, MOV or WebM video")
