"""Short-lived signed links for viewing evidence.

<img> and <video> tags cannot send an Authorization header, so the API hands
out URLs that are valid for a few minutes and only for one file.
"""

import base64
import hashlib
import hmac
import time
import uuid

from app.core.config import get_settings


def _signature(media_id: uuid.UUID, expires: int) -> str:
    key = get_settings().secret_key.encode()
    digest = hmac.new(key, f"media:{media_id}:{expires}".encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


def signed_media_url(media_id: uuid.UUID, *, now: float | None = None) -> str:
    expires = int((now or time.time()) + get_settings().media_url_minutes * 60)
    return f"/api/v1/media/{media_id}?exp={expires}&sig={_signature(media_id, expires)}"


def verify_media_signature(media_id: uuid.UUID, expires: int, signature: str) -> bool:
    if expires < time.time():
        return False
    return hmac.compare_digest(_signature(media_id, expires), signature)
