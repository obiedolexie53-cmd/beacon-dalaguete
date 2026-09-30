"""Rules for a new report. packages/shared/src/reportRules.ts mirrors these for the app."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

LOCAL_TZ = ZoneInfo("Asia/Manila")

DESCRIPTION_MIN = 10
DESCRIPTION_MAX = 2000
OTHER_HAZARD_MIN = 3
OTHER_HAZARD_MAX = 120
LANDMARK_MAX = 200
# Reports are for recent incidents; older events are recorded by the MDRRMO directly.
MAX_INCIDENT_AGE_DAYS = 365
# Allow for a phone clock that runs a little fast.
CLOCK_SKEW = timedelta(minutes=5)


def local_now() -> datetime:
    return datetime.now(LOCAL_TZ)


def check_incident_date(incident_date: date) -> None:
    """The incident must be within the past year (Dalaguete local time)."""
    now = local_now()
    if incident_date > (now + CLOCK_SKEW).date():
        raise ValueError("The incident date cannot be in the future")
    if incident_date < now.date() - timedelta(days=MAX_INCIDENT_AGE_DAYS):
        raise ValueError("The incident date must be within the past year")


def check_incident_time(incident_date: date, incident_time: time) -> None:
    """Together, the date and time must not be in the future."""
    moment = datetime.combine(incident_date, incident_time, tzinfo=LOCAL_TZ)
    if moment > local_now() + CLOCK_SKEW:
        raise ValueError("The incident time cannot be in the future")
