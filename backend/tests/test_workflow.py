import pytest

from app.reports.reference import REFERENCE_PATTERN, format_reference_number
from app.reports.workflow import (
    ALLOWED_TRANSITIONS,
    INITIAL_STATUS,
    STATUS_LABELS,
    InvalidStatusTransition,
    ReportStatus,
    can_transition,
    ensure_transition,
)
from seeds.barangays import DALAGUETE_BARANGAYS
from seeds.hazard_types import DEFAULT_HAZARD_TYPES

S = ReportStatus


def test_new_reports_start_as_submitted() -> None:
    assert INITIAL_STATUS is S.SUBMITTED


def test_submitted_report_cannot_be_verified_directly() -> None:
    assert not can_transition(S.SUBMITTED, S.VERIFIED)
    with pytest.raises(InvalidStatusTransition):
        ensure_transition(S.SUBMITTED, S.VERIFIED)


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (S.SUBMITTED, S.UNDER_VERIFICATION),
        (S.UNDER_VERIFICATION, S.VERIFIED),
        (S.VERIFIED, S.RESOLVED),
        (S.SUBMITTED, S.NEEDS_CLARIFICATION),
        (S.UNDER_VERIFICATION, S.NEEDS_CLARIFICATION),
        (S.NEEDS_CLARIFICATION, S.UNDER_VERIFICATION),
    ],
)
def test_allowed_transitions(current: ReportStatus, target: ReportStatus) -> None:
    ensure_transition(current, target)


def test_resolved_is_final() -> None:
    assert ALLOWED_TRANSITIONS[S.RESOLVED] == frozenset()


def test_every_status_has_label_and_transitions() -> None:
    assert set(STATUS_LABELS) == set(S) == set(ALLOWED_TRANSITIONS)


def test_reference_number_format() -> None:
    ref = format_reference_number(2026, 123)
    assert ref == "BEA-2026-000123"
    assert REFERENCE_PATTERN.match(ref)
    with pytest.raises(ValueError):
        format_reference_number(2026, 0)


def test_seed_data_includes_required_hazards_and_sample_barangay() -> None:
    codes = {code for code, _ in DEFAULT_HAZARD_TYPES}
    assert {"flood", "landslide", "earthquake", "typhoon", "fire", "other"} <= codes
    assert "Mantalongon" in DALAGUETE_BARANGAYS
    assert len(DALAGUETE_BARANGAYS) == len(set(DALAGUETE_BARANGAYS))
