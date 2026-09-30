"""Reading MDRRMO incident records from CSV files.

Every row is checked before anything is saved; problems are reported by row
number so the file can be corrected and imported again. See
docs/templates/mdrrmo_records_template.csv for the expected columns.
"""

import csv
import io
import re
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal, InvalidOperation

from app.reports.validation import (
    DESCRIPTION_MAX,
    LANDMARK_MAX,
    OTHER_HAZARD_MAX,
    in_service_area,
    local_now,
)
from app.reports.workflow import STATUS_LABELS, ReportStatus

REQUIRED_COLUMNS = ("date", "hazard", "barangay", "description")
OPTIONAL_COLUMNS = (
    "time",
    "other_hazard",
    "landmark",
    "latitude",
    "longitude",
    "status",
    "external_ref",
)
MAX_ROWS = 20_000
EXTERNAL_REF_MAX = 60
EARLIEST_DATE = date(1990, 1, 1)

#: Imported records come from the MDRRMO's own files, so they are already confirmed.
IMPORT_STATUSES = (ReportStatus.VERIFIED, ReportStatus.RESOLVED)
DEFAULT_IMPORT_STATUS = ReportStatus.RESOLVED


@dataclass(frozen=True)
class RecordRow:
    """One validated incident record, ready to save."""

    row_number: int
    incident_date: date
    incident_time: time | None
    hazard_code: str
    other_hazard_text: str | None
    barangay_id: int
    description: str
    landmark: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    status: ReportStatus
    external_ref: str | None


@dataclass(frozen=True)
class RowError:
    row_number: int  # 1 is the header row, as in a spreadsheet
    column: str | None
    message: str

    def __str__(self) -> str:
        where = f"Row {self.row_number}" + (f", {self.column}" if self.column else "")
        return f"{where}: {self.message}"


class Lookups:
    """Names accepted in the hazard, barangay and status columns (case-insensitive)."""

    def __init__(self, hazards: dict[str, str], barangays: dict[str, int]):
        self.hazards: dict[str, str] = {}
        for code, name in hazards.items():
            self.hazards[name_key(code)] = code
            self.hazards[name_key(name)] = code
        self.barangays = {name_key(name): id_ for name, id_ in barangays.items()}
        self.statuses: dict[str, ReportStatus] = {}
        for status in IMPORT_STATUSES:
            self.statuses[name_key(status.value)] = status
            self.statuses[name_key(STATUS_LABELS[status])] = status


def name_key(text: str) -> str:
    return re.sub(r"[\s_\-]+", " ", text.strip().lower())


def _parse_date(text: str) -> date:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError("Use YYYY-MM-DD (e.g. 2025-09-28) or MM/DD/YYYY (e.g. 09/28/2025)")


def _parse_time(text: str) -> time:
    compact = text.strip().upper().replace(".", "")
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p"):
        try:
            return datetime.strptime(compact, fmt).time()
        except ValueError:
            continue
    raise ValueError("Use 24-hour HH:MM (e.g. 16:35) or h:mm AM/PM (e.g. 4:35 PM)")


def _parse_coordinate(text: str) -> Decimal:
    try:
        value = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError("Must be a decimal number, e.g. 9.7612") from exc
    if not value.is_finite():
        raise ValueError("Must be a decimal number, e.g. 9.7612")
    return value.quantize(Decimal("0.000001"))


def read_records(text: str, lookups: Lookups) -> tuple[list[RecordRow], list[RowError]]:
    """Parse and validate a CSV file. Returns the valid rows and every problem found."""
    reader = csv.DictReader(io.StringIO(text.removeprefix("﻿")))
    headers = [name_key(h).replace(" ", "_") for h in reader.fieldnames or []]
    errors: list[RowError] = []
    missing = [c for c in REQUIRED_COLUMNS if c not in headers]
    if missing:
        errors.append(RowError(1, None, f"Missing required column(s): {', '.join(missing)}"))
    unknown = [h for h in headers if h and h not in REQUIRED_COLUMNS + OPTIONAL_COLUMNS]
    if unknown:
        errors.append(RowError(1, None, f"Unknown column(s): {', '.join(unknown)}"))
    if len(set(headers)) != len(headers):
        errors.append(RowError(1, None, "A column name appears more than once"))
    if errors:
        return [], errors
    reader.fieldnames = headers

    rows: list[RecordRow] = []
    seen_refs: dict[str, int] = {}
    today = local_now().date()
    for index, raw in enumerate(reader, start=2):
        if index - 1 > MAX_ROWS:
            errors.append(RowError(index, None, f"Files are limited to {MAX_ROWS} records"))
            break
        if None in raw:  # more cells than headers
            errors.append(RowError(index, None, "Row has more cells than there are columns"))
            continue
        cells = {k: (v or "").strip() for k, v in raw.items()}
        if not any(cells.values()):
            continue  # blank line
        row_errors: list[RowError] = []

        def fail(
            column: str, message: str, _row: int = index, _errors: list[RowError] = row_errors
        ) -> None:
            _errors.append(RowError(_row, column, message))

        incident_date = incident_time = None
        if not cells["date"]:
            fail("date", "Required")
        else:
            try:
                incident_date = _parse_date(cells["date"])
                if incident_date > today:
                    fail("date", "Cannot be in the future")
                elif incident_date < EARLIEST_DATE:
                    fail("date", f"Must be on or after {EARLIEST_DATE.isoformat()}")
            except ValueError as exc:
                fail("date", str(exc))
        if cells.get("time"):
            try:
                incident_time = _parse_time(cells["time"])
            except ValueError as exc:
                fail("time", str(exc))

        hazard_code = lookups.hazards.get(name_key(cells["hazard"]))
        if not cells["hazard"]:
            fail("hazard", "Required")
        elif hazard_code is None:
            fail("hazard", f'Unknown hazard type "{cells["hazard"]}"')
        other = cells.get("other_hazard") or None
        if hazard_code == "other" and not other:
            fail("other_hazard", 'Describe the hazard when the type is "Other Hazard"')
        elif other and hazard_code != "other":
            other = None  # only meaningful for "Other Hazard"
        if other and len(other) > OTHER_HAZARD_MAX:
            fail("other_hazard", f"At most {OTHER_HAZARD_MAX} characters")

        barangay_id = lookups.barangays.get(name_key(cells["barangay"]))
        if not cells["barangay"]:
            fail("barangay", "Required")
        elif barangay_id is None:
            fail("barangay", f'Unknown barangay "{cells["barangay"]}"')

        description = " ".join(cells["description"].split())
        if not description:
            fail("description", "Required")
        elif len(description) > DESCRIPTION_MAX:
            fail("description", f"At most {DESCRIPTION_MAX} characters")
        landmark = cells.get("landmark") or None
        if landmark and len(landmark) > LANDMARK_MAX:
            fail("landmark", f"At most {LANDMARK_MAX} characters")

        latitude = longitude = None
        lat_text, lng_text = cells.get("latitude", ""), cells.get("longitude", "")
        if bool(lat_text) != bool(lng_text):
            fail("latitude", "Give both latitude and longitude, or neither")
        elif lat_text:
            try:
                latitude = _parse_coordinate(lat_text)
                longitude = _parse_coordinate(lng_text)
                if not in_service_area(float(latitude), float(longitude)):
                    fail("latitude", "The coordinates are outside the Dalaguete area")
            except ValueError as exc:
                fail("latitude", str(exc))

        status = DEFAULT_IMPORT_STATUS
        if cells.get("status"):
            found = lookups.statuses.get(name_key(cells["status"]))
            if found is None:
                fail("status", "Must be Verified or Resolved (records from MDRRMO files)")
            else:
                status = found

        external_ref = cells.get("external_ref") or None
        if external_ref:
            if len(external_ref) > EXTERNAL_REF_MAX:
                fail("external_ref", f"At most {EXTERNAL_REF_MAX} characters")
            elif external_ref in seen_refs:
                fail("external_ref", f"Same record number as row {seen_refs[external_ref]}")
            else:
                seen_refs[external_ref] = index

        if row_errors:
            errors.extend(row_errors)
            continue
        assert incident_date is not None and hazard_code is not None and barangay_id is not None
        rows.append(
            RecordRow(
                row_number=index,
                incident_date=incident_date,
                incident_time=incident_time,
                hazard_code=hazard_code,
                other_hazard_text=other,
                barangay_id=barangay_id,
                description=description,
                landmark=landmark,
                latitude=latitude,
                longitude=longitude,
                status=status,
                external_ref=external_ref,
            )
        )
    if not rows and not errors:
        errors.append(RowError(1, None, "The file has no records"))
    return rows, errors
