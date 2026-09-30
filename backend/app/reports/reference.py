"""Report reference numbers (generated server-side only).

Resident reports are numbered BEA-2026-000123. Records imported from MDRRMO files
(and generated DEMO history) use their own counter, IMP-2026-000001, so they never
take numbers from, or look like, reports submitted through the app.
"""

import re

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import ReportSequence

REFERENCE_PREFIX = "BEA"
IMPORT_PREFIX = "IMP"
REFERENCE_PATTERN = re.compile(r"^BEA-\d{4}-\d{6}$")
ANY_REFERENCE_PATTERN = re.compile(r"^(BEA|IMP)-\d{4}-\d{6}$")


def format_reference_number(year: int, sequence: int, prefix: str = REFERENCE_PREFIX) -> str:
    """Format the per-year sequence number allocated by the database."""
    if not 1 <= sequence <= 999_999:
        raise ValueError("Reference sequence must be between 1 and 999999")
    return f"{prefix}-{year:04d}-{sequence:06d}"


def allocate_reference_number(db: Session, year: int, prefix: str = REFERENCE_PREFIX) -> str:
    """Atomically take the next number for `prefix` and `year`. Safe under concurrent use."""
    stmt = (
        insert(ReportSequence)
        .values(prefix=prefix, year=year, last_value=1)
        .on_conflict_do_update(
            index_elements=[ReportSequence.prefix, ReportSequence.year],
            set_={"last_value": ReportSequence.last_value + 1},
        )
        .returning(ReportSequence.last_value)
    )
    return format_reference_number(year, db.execute(stmt).scalar_one(), prefix)


def reserve_reference_number(
    db: Session, year: int, sequence: int, prefix: str = REFERENCE_PREFIX
) -> str:
    """Claim a specific number (used for fixed DEMO records) so it is never allocated again."""
    stmt = (
        insert(ReportSequence)
        .values(prefix=prefix, year=year, last_value=sequence)
        .on_conflict_do_update(
            index_elements=[ReportSequence.prefix, ReportSequence.year],
            set_={"last_value": func.greatest(ReportSequence.last_value, sequence)},
        )
    )
    db.execute(stmt)
    return format_reference_number(year, sequence, prefix)
