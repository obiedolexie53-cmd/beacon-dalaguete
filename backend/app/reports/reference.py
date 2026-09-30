"""Report reference numbers, e.g. BEA-2026-000123 (generated server-side only)."""

import re

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import ReportSequence

REFERENCE_PREFIX = "BEA"
REFERENCE_PATTERN = re.compile(r"^BEA-\d{4}-\d{6}$")


def format_reference_number(year: int, sequence: int) -> str:
    """Format the per-year sequence number allocated by the database."""
    if not 1 <= sequence <= 999_999:
        raise ValueError("Reference sequence must be between 1 and 999999")
    return f"{REFERENCE_PREFIX}-{year:04d}-{sequence:06d}"


def allocate_reference_number(db: Session, year: int) -> str:
    """Atomically take the next number for `year`. Safe under concurrent submissions."""
    stmt = (
        insert(ReportSequence)
        .values(year=year, last_value=1)
        .on_conflict_do_update(
            index_elements=[ReportSequence.year],
            set_={"last_value": ReportSequence.last_value + 1},
        )
        .returning(ReportSequence.last_value)
    )
    return format_reference_number(year, db.execute(stmt).scalar_one())


def reserve_reference_number(db: Session, year: int, sequence: int) -> str:
    """Claim a specific number (used for fixed DEMO records) so it is never allocated again."""
    stmt = (
        insert(ReportSequence)
        .values(year=year, last_value=sequence)
        .on_conflict_do_update(
            index_elements=[ReportSequence.year],
            set_={"last_value": func.greatest(ReportSequence.last_value, sequence)},
        )
    )
    db.execute(stmt)
    return format_reference_number(year, sequence)
