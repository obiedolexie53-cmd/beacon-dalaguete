"""Report reference numbers, e.g. BEA-2026-000123 (generated server-side only)."""

import re

REFERENCE_PREFIX = "BEA"
REFERENCE_PATTERN = re.compile(r"^BEA-\d{4}-\d{6}$")


def format_reference_number(year: int, sequence: int) -> str:
    """Format the per-year sequence number allocated by the database."""
    if not 1 <= sequence <= 999_999:
        raise ValueError("Reference sequence must be between 1 and 999999")
    return f"{REFERENCE_PREFIX}-{year:04d}-{sequence:06d}"
