"""Remove metadata from uploaded videos with ffmpeg.

Phones record the place a video was taken (e.g. QuickTime/MP4 location tags,
Apple timed-metadata tracks), the device model and the time. Before a video is
stored it is remuxed without re-encoding (`-c copy`, so quality and speed are
unaffected), keeping only the first video stream and the audio streams, and
dropping all container, stream and chapter metadata plus any data, subtitle or
attachment streams. ffprobe first confirms the file really contains video.

ffmpeg/ffprobe must be installed (the API Docker image includes them). In
production a missing ffmpeg makes video uploads fail rather than store a video
with its location still inside.
"""

import json
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO

from app.media.processing import InvalidMediaError

#: ffmpeg muxer for each stored container.
MUXERS = {"mp4": "mp4", "mov": "mov", "3gp": "3gp", "webm": "webm"}
TIMEOUT_SECONDS = 120


class VideoToolsMissing(RuntimeError):
    pass


@dataclass(frozen=True)
class CleanVideo:
    path: Path
    width: int | None
    height: int | None


def tools_available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def _run(args: list[str]) -> subprocess.CompletedProcess[bytes]:
    try:
        return subprocess.run(  # noqa: S603 (fixed arguments, no shell)
            args, capture_output=True, timeout=TIMEOUT_SECONDS, check=False
        )
    except subprocess.TimeoutExpired as exc:
        raise InvalidMediaError("This video took too long to process") from exc


def clean_video(source: BinaryIO, extension: str, workdir: Path) -> CleanVideo:
    """Copy `source` into `workdir`, strip its metadata and return the clean file."""
    if not tools_available():
        raise VideoToolsMissing("ffmpeg and ffprobe are required to process videos")
    original = workdir / f"original.{extension}"
    with original.open("wb") as out:
        shutil.copyfileobj(source, out, length=1024 * 1024)

    probe = _run(
        [
            shutil.which("ffprobe") or "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,width,height",
            "-of",
            "json",
            str(original),
        ]
    )
    try:
        streams = json.loads(probe.stdout or b"{}").get("streams", [])
    except json.JSONDecodeError:
        streams = []
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    if probe.returncode != 0 or video is None:
        raise InvalidMediaError("This video could not be read. It may be damaged.")

    cleaned = workdir / f"clean.{extension}"
    args = [
        shutil.which("ffmpeg") or "ffmpeg",
        "-nostdin",
        "-v",
        "error",
        "-i",
        str(original),
        "-map",
        "0:V:0",
        "-map",
        "0:a?",
        "-c",
        "copy",
        "-map_metadata",
        "-1",
        "-map_metadata:s",
        "-1",
        "-map_chapters",
        "-1",
        "-dn",
        "-sn",
        "-fflags",
        "+bitexact",
        "-flags:v",
        "+bitexact",
        "-flags:a",
        "+bitexact",
    ]
    if extension != "webm":
        args += ["-movflags", "+faststart"]
    args += ["-f", MUXERS[extension], "-y", str(cleaned)]
    result = _run(args)
    original.unlink(missing_ok=True)
    if result.returncode != 0 or not cleaned.is_file() or cleaned.stat().st_size == 0:
        raise InvalidMediaError("This video could not be processed. Try another file.")
    return CleanVideo(cleaned, video.get("width"), video.get("height"))


def temporary_workdir() -> tempfile.TemporaryDirectory[str]:
    return tempfile.TemporaryDirectory(prefix="beacon-video-")
