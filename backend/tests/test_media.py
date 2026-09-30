import hashlib
import io
import time
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.media import service as media_service
from app.media.signing import signed_media_url
from app.models import AuditLog, ReportMedia, UserRole
from app.reports.workflow import ReportStatus
from tests.factories import PASSWORD, make_report, make_user

pytestmark = pytest.mark.db

GPS_IFD = 0x8825
ORIENTATION = 0x0112


def jpeg_with_gps(size: tuple[int, int] = (200, 100), orientation: int = 1) -> bytes:
    image = Image.new("RGB", size, (200, 80, 40))
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"
    exif[ORIENTATION] = orientation
    exif[GPS_IFD] = {1: "N", 2: (9.0, 50.0, 28.0), 3: "E", 4: (123.0, 29.0, 14.0)}
    out = io.BytesIO()
    image.save(out, format="JPEG", exif=exif)
    return out.getvalue()


def png_with_alpha() -> bytes:
    out = io.BytesIO()
    Image.new("RGBA", (40, 40), (0, 0, 0, 0)).save(out, format="PNG")
    return out.getvalue()


MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 2048
MOV = b"\x00\x00\x00\x14ftypqt  " + b"\x00" * 2048
WEBM = b"\x1a\x45\xdf\xa3" + b"\x00" * 2048


@pytest.fixture(autouse=True)
def media_root(tmp_path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(get_settings(), "media_root", tmp_path)
    return tmp_path


@pytest.fixture
def resident(db: Session):
    return make_user(db, email="leona@example.com")


@pytest.fixture
def report(db: Session, resident):
    return make_report(db, resident)


def auth(api: TestClient, email: str = "leona@example.com") -> dict[str, str]:
    token = api.post("/api/v1/auth/login", json={"identifier": email, "password": PASSWORD}).json()[
        "access_token"
    ]
    return {"Authorization": f"Bearer {token}"}


def upload(api: TestClient, reference_no: str, data: bytes, headers, name: str = "file.jpg"):
    return api.post(
        f"/api/v1/me/reports/{reference_no}/media",
        files={"file": (name, data, "application/octet-stream")},
        headers=headers,
    )


# ---------- Photos ----------


def test_photo_is_stored_privately_without_metadata(
    api: TestClient, db: Session, report, media_root
) -> None:
    response = upload(api, report.reference_no, jpeg_with_gps(), auth(api))
    assert response.status_code == 201
    body = response.json()
    assert (body["kind"], body["mime_type"]) == ("photo", "image/jpeg")

    media = db.get(ReportMedia, body["id"])
    stored = (media_root / media.storage_key).read_bytes()
    assert hashlib.sha256(stored).hexdigest() == media.sha256
    with Image.open(io.BytesIO(stored)) as image:
        exif = image.getexif()
        assert len(exif) == 0
        assert not exif.get_ifd(GPS_IFD)
    assert db.scalar(select(AuditLog).where(AuditLog.action == "report.media_added"))


def test_photo_orientation_is_applied(api: TestClient, report) -> None:
    body = upload(api, report.reference_no, jpeg_with_gps((200, 100), orientation=6), auth(api))
    assert (body.json()["width"], body.json()["height"]) == (100, 200)


def test_png_is_converted_to_jpeg(api: TestClient, report) -> None:
    body = upload(api, report.reference_no, png_with_alpha(), auth(api), "a.png").json()
    assert body["mime_type"] == "image/jpeg"


def test_file_type_comes_from_the_content_not_the_name(api: TestClient, report) -> None:
    fake = upload(api, report.reference_no, b"<script>alert(1)</script>", auth(api), "x.jpg")
    assert fake.status_code == 415
    assert fake.json()["error"]["code"] == "unsupported_media"

    broken = upload(api, report.reference_no, b"\xff\xd8\xff" + b"garbage" * 50, auth(api))
    assert broken.status_code == 415


def test_decompression_bombs_are_rejected(
    api: TestClient, report, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1_000)
    response = upload(api, report.reference_no, jpeg_with_gps((200, 100)), auth(api))
    assert response.status_code == 415


# ---------- Videos ----------


@pytest.mark.parametrize(
    ("data", "mime"),
    [(MP4, "video/mp4"), (MOV, "video/quicktime"), (WEBM, "video/webm")],
)
def test_videos_are_accepted(api: TestClient, report, data: bytes, mime: str) -> None:
    response = upload(api, report.reference_no, data, auth(api), "clip.bin")
    assert response.status_code == 201
    assert response.json()["mime_type"] == mime
    assert response.json()["size_bytes"] == len(data)


def test_large_videos_are_rejected(
    api: TestClient, report, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(media_service.LIMITS, media_service.MediaKind.VIDEO, (2, 1000, "videos"))
    response = upload(api, report.reference_no, MP4, auth(api))
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"


# ---------- Limits and access ----------


def test_photo_limit_per_report(api: TestClient, report) -> None:
    headers = auth(api)
    for _ in range(5):
        assert upload(api, report.reference_no, jpeg_with_gps(), headers).status_code == 201
    sixth = upload(api, report.reference_no, jpeg_with_gps(), headers)
    assert sixth.status_code == 409
    assert sixth.json()["error"]["code"] == "too_many_files"
    assert (
        upload(api, report.reference_no, MP4, headers).status_code == 201
    )  # videos counted separately


def test_cannot_add_evidence_to_someone_elses_report(api: TestClient, db: Session, report) -> None:
    make_user(db, email="other@example.com")
    response = upload(api, report.reference_no, jpeg_with_gps(), auth(api, "other@example.com"))
    assert response.status_code == 404
    assert (
        api.get(
            f"/api/v1/me/reports/{report.reference_no}/media",
            headers=auth(api, "other@example.com"),
        ).status_code
        == 404
    )


def test_staff_and_anonymous_cannot_use_resident_upload(
    api: TestClient, db: Session, report
) -> None:
    make_user(db, role=UserRole.MDRRMO, email="officer@example.gov.ph")
    staff = api.post(
        "/api/v1/staff/auth/login",
        json={"identifier": "officer@example.gov.ph", "password": PASSWORD},
    ).json()["access_token"]
    assert upload(api, report.reference_no, jpeg_with_gps(), {}).status_code == 401
    assert (
        upload(
            api, report.reference_no, jpeg_with_gps(), {"Authorization": f"Bearer {staff}"}
        ).status_code
        == 401
    )


def test_evidence_closes_once_verified(api: TestClient, db: Session, resident) -> None:
    verified = make_report(db, resident, status=ReportStatus.VERIFIED)
    response = upload(api, verified.reference_no, jpeg_with_gps(), auth(api))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "evidence_closed"


# ---------- Signed links ----------


def test_signed_link_serves_the_file(api: TestClient, report) -> None:
    headers = auth(api)
    upload(api, report.reference_no, jpeg_with_gps(), headers)
    [media] = api.get(f"/api/v1/me/reports/{report.reference_no}/media", headers=headers).json()

    response = api.get(media["url"])  # no Authorization header needed
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cache-control"].startswith("private")

    partial = api.get(media["url"], headers={"Range": "bytes=0-9"})
    assert partial.status_code == 206
    assert len(partial.content) == 10


def test_tampered_or_expired_links_are_refused(api: TestClient, db: Session, report) -> None:
    body = upload(api, report.reference_no, jpeg_with_gps(), auth(api)).json()
    url = urlparse(body["url"])
    query = parse_qs(url.query)

    tampered = f"{url.path}?exp={query['exp'][0]}&sig={'A' * 43}"
    assert api.get(tampered).status_code == 404

    longer = f"{url.path}?exp={int(query['exp'][0]) + 3600}&sig={query['sig'][0]}"
    assert api.get(longer).status_code == 404

    expired = signed_media_url(body["id"], now=time.time() - 3600)
    assert api.get(expired).status_code == 404

    unsigned = api.get(url.path)
    assert unsigned.status_code == 422
