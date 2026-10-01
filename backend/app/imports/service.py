"""Saving imported MDRRMO records (and generated DEMO history) as reports."""

import uuid
from collections.abc import Sequence
from datetime import datetime, time

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.audit.service import record
from app.imports.records import Lookups, RecordRow, RowError
from app.models import Barangay, HazardType, ImportBatch, Report, ReportSource, ReportStatusHistory
from app.reports.reference import IMPORT_PREFIX, allocate_reference_number
from app.reports.validation import LOCAL_TZ

#: Records without a time are stamped at midday so they sort within their day.
UNKNOWN_TIME_STAMP = time(12, 0)


def load_lookups(db: Session) -> Lookups:
    hazards = dict(db.execute(select(HazardType.code, HazardType.name)).all())
    barangays = dict(db.execute(select(Barangay.name, Barangay.id)).all())
    return Lookups(hazards, barangays)


def existing_external_refs(db: Session, rows: Sequence[RecordRow]) -> list[RowError]:
    """Record numbers that were already imported (so a file is not imported twice)."""
    refs = {r.external_ref: r.row_number for r in rows if r.external_ref}
    if not refs:
        return []
    found = db.scalars(select(Report.external_ref).where(Report.external_ref.in_(refs))).all()
    return [
        RowError(refs[ref], "external_ref", f"Record {ref} was already imported")
        for ref in sorted(found, key=lambda ref: refs[ref])
    ]


def save_records(
    db: Session,
    rows: Sequence[RecordRow],
    *,
    filename: str,
    imported_by_id: uuid.UUID | None,
    is_demo: bool = False,
) -> ImportBatch:
    """Save validated rows as one import batch (in the caller's transaction).

    Records are numbered IMP-YYYY-NNNNNN in date order, carry a status history
    entry noting where they came from, and never notify anyone.
    """
    batch = ImportBatch(
        filename=filename[:200], imported_by_id=imported_by_id, row_count=len(rows), is_demo=is_demo
    )
    db.add(batch)
    db.flush()
    hazard_ids = dict(db.execute(select(HazardType.code, HazardType.id)).all())
    note = f"Imported from MDRRMO records ({batch.filename})."
    ordered = sorted(
        rows, key=lambda r: (r.incident_date, r.incident_time or UNKNOWN_TIME_STAMP, r.row_number)
    )
    for row in ordered:
        recorded_at = datetime.combine(
            row.incident_date, row.incident_time or UNKNOWN_TIME_STAMP, tzinfo=LOCAL_TZ
        )
        report = Report(
            reference_no=allocate_reference_number(db, row.incident_date.year, IMPORT_PREFIX),
            reporter_id=None,
            source=ReportSource.IMPORT,
            import_batch_id=batch.id,
            external_ref=row.external_ref,
            hazard_type_id=hazard_ids[row.hazard_code],
            other_hazard_text=row.other_hazard_text,
            description=row.description,
            incident_date=row.incident_date,
            incident_time=row.incident_time,
            barangay_id=row.barangay_id,
            landmark=row.landmark,
            latitude=row.latitude,
            longitude=row.longitude,
            status=row.status,
            is_demo=is_demo,
            submitted_at=recorded_at,
        )
        db.add(report)
        db.flush()
        db.add(
            ReportStatusHistory(
                report_id=report.id,
                from_status=None,
                to_status=row.status,
                changed_by_id=imported_by_id,
                note=note,
                changed_at=func.now(),
            )
        )
    record(
        db,
        "records.imported",
        actor_id=imported_by_id,
        entity="import_batch",
        entity_id=str(batch.id),
        details={"filename": batch.filename, "rows": len(rows), "is_demo": is_demo},
    )
    return batch


def delete_batch(db: Session, batch_id: uuid.UUID, *, actor_id: uuid.UUID | None = None) -> int:
    """Remove an import batch and every record it created. Returns the number removed."""
    batch = db.get(ImportBatch, batch_id)
    if batch is None:
        raise LookupError(f"No import batch {batch_id}")
    count = db.scalar(select(func.count()).where(Report.import_batch_id == batch_id)) or 0
    # Reports and their history are removed by ON DELETE CASCADE.
    db.execute(delete(ImportBatch).where(ImportBatch.id == batch_id))
    db.expire_all()
    record(
        db,
        "records.import_deleted",
        actor_id=actor_id,
        entity="import_batch",
        entity_id=str(batch_id),
        details={"filename": batch.filename, "rows": count},
    )
    return count
