"""Evidence limits. Mirrored in packages/shared/src/evidence.ts."""

MAX_PHOTOS_PER_REPORT = 5
MAX_VIDEOS_PER_REPORT = 2
MAX_PHOTO_BYTES = 15 * 1024 * 1024  # before server re-encoding
MAX_VIDEO_BYTES = 50 * 1024 * 1024
# Guards against "decompression bomb" images that are small files but huge in memory.
MAX_PHOTO_PIXELS = 50_000_000
# Stored photos are resized to fit within this many pixels on the longest side.
STORED_PHOTO_MAX_SIDE = 2560
