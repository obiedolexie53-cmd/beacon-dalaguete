"""Report status workflow.

    submitted ─► under_verification ─► verified ─► resolved
        │               │    ▲
        └───────────────┴──► needs_clarification

A new report always starts as SUBMITTED. Only authorized MDRRMO personnel move
a report forward, and nothing becomes VERIFIED automatically.
packages/shared/src/reportStatus.ts mirrors this module for the clients. This
module is the source of truth.
"""

from enum import StrEnum


class ReportStatus(StrEnum):
    SUBMITTED = "submitted"
    UNDER_VERIFICATION = "under_verification"
    NEEDS_CLARIFICATION = "needs_clarification"
    VERIFIED = "verified"
    RESOLVED = "resolved"


INITIAL_STATUS = ReportStatus.SUBMITTED

STATUS_LABELS: dict[ReportStatus, str] = {
    ReportStatus.SUBMITTED: "Submitted",
    ReportStatus.UNDER_VERIFICATION: "Under Verification",
    ReportStatus.NEEDS_CLARIFICATION: "For Verification / Needs Clarification",
    ReportStatus.VERIFIED: "Verified",
    ReportStatus.RESOLVED: "Resolved",
}

ALLOWED_TRANSITIONS: dict[ReportStatus, frozenset[ReportStatus]] = {
    ReportStatus.SUBMITTED: frozenset(
        {ReportStatus.UNDER_VERIFICATION, ReportStatus.NEEDS_CLARIFICATION}
    ),
    ReportStatus.UNDER_VERIFICATION: frozenset(
        {ReportStatus.VERIFIED, ReportStatus.NEEDS_CLARIFICATION}
    ),
    ReportStatus.NEEDS_CLARIFICATION: frozenset({ReportStatus.UNDER_VERIFICATION}),
    ReportStatus.VERIFIED: frozenset({ReportStatus.RESOLVED}),
    ReportStatus.RESOLVED: frozenset(),
}


class InvalidStatusTransition(ValueError):
    def __init__(self, current: ReportStatus, target: ReportStatus) -> None:
        super().__init__(
            f"Cannot change report status from '{STATUS_LABELS[current]}' "
            f"to '{STATUS_LABELS[target]}'"
        )
        self.current = current
        self.target = target


def can_transition(current: ReportStatus, target: ReportStatus) -> bool:
    return target in ALLOWED_TRANSITIONS[current]


def ensure_transition(current: ReportStatus, target: ReportStatus) -> None:
    """Raise InvalidStatusTransition unless current → target is allowed."""
    if not can_transition(current, target):
        raise InvalidStatusTransition(current, target)
