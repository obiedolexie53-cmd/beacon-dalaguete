"""Administrative commands.

    uv run python -m app.cli create-staff --email officer@example.gov.ph --name "Juan Dela Cruz"
    uv run python -m app.cli create-staff --email admin@example.gov.ph --name "..." --role admin
    uv run python -m app.cli set-staff-active --email officer@example.gov.ph --inactive
    uv run python -m app.cli seed-demo          # development/test only

This is the only way to create MDRRMO accounts: there is no public staff
registration. Passwords are typed at a hidden prompt (or piped with
--password-stdin) and never passed as command-line arguments, which would leave
them in shell history.
"""

import argparse
import getpass
import sys
from collections.abc import Sequence
from datetime import timedelta

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.service import record
from app.auth.validation import check_password_strength
from app.core.config import get_settings
from app.core.db import get_engine
from app.core.security import hash_password
from app.models import (
    Barangay,
    HazardType,
    Notification,
    Report,
    ReportStatusHistory,
    User,
    UserRole,
)
from app.notifications.service import STATUS_MESSAGES
from app.reports.reference import reserve_reference_number
from app.reports.workflow import ReportStatus
from seeds.demo_reports import DEMO_REPORTS

DEMO_PASSWORD = "BeaconDemo-2026"  # noqa: S105  (development/test demo accounts only)


class CliError(Exception):
    pass


def _read_password(from_stdin: bool, email: str) -> str:
    if from_stdin:
        password = sys.stdin.readline().rstrip("\n")
    else:
        password = getpass.getpass("Password: ")
        if getpass.getpass("Confirm password: ") != password:
            raise CliError("Passwords do not match")
    try:
        check_password_strength(password, identifiers=(email,))
    except ValueError as exc:
        raise CliError(str(exc)) from exc
    if len(password) < 12:
        raise CliError("Staff passwords must be at least 12 characters")
    return password


def create_staff(db: Session, *, email: str, full_name: str, role: UserRole, password: str) -> User:
    if role not in (UserRole.MDRRMO, UserRole.ADMIN):
        raise CliError("Staff role must be 'mdrrmo' or 'admin'")
    try:
        email = validate_email(email, check_deliverability=False).normalized.lower()
    except EmailNotValidError as exc:
        raise CliError(f"Invalid email: {exc}") from exc
    if db.scalar(select(User.id).where(User.email == email)):
        raise CliError(f"An account with email {email} already exists")
    user = User(
        full_name=" ".join(full_name.split()),
        email=email,
        password_hash=hash_password(password),
        role=role,
    )
    db.add(user)
    db.flush()
    record(
        db,
        "account.staff_created",
        entity="user",
        entity_id=str(user.id),
        details={"role": role.value, "via": "cli"},
    )
    db.commit()
    return user


def set_staff_active(db: Session, *, email: str, active: bool) -> User:
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None or not user.is_staff:
        raise CliError(f"No staff account with email {email}")
    user.is_active = active
    record(
        db,
        "account.staff_activated" if active else "account.staff_deactivated",
        entity="user",
        entity_id=str(user.id),
        details={"via": "cli"},
    )
    db.commit()
    return user


DEMO_ACCOUNTS = [
    # (full_name, email, phone, role, barangay)
    (
        "Leona Legaspi",
        "leona.legaspi@demo.beacon.local",
        "+639170000123",
        UserRole.RESIDENT,
        "Mantalongon",
    ),
    ("MDRRMO Demo Officer", "mdrrmo.officer@demo.beacon.local", None, UserRole.MDRRMO, None),
]


def seed_demo(db: Session) -> list[str]:
    """Create fictional DEMO accounts for development and evaluation walkthroughs."""
    if get_settings().environment == "production":
        raise CliError("Demo accounts cannot be created in production")
    created: list[str] = []
    for full_name, email, phone, role, barangay_name in DEMO_ACCOUNTS:
        if db.scalar(select(User.id).where(User.email == email)):
            continue
        barangay_id = (
            db.scalar(select(Barangay.id).where(Barangay.name == barangay_name))
            if barangay_name
            else None
        )
        db.add(
            User(
                full_name=full_name,
                email=email,
                phone=phone,
                password_hash=hash_password(DEMO_PASSWORD),
                role=role,
                barangay_id=barangay_id,
                is_demo=True,
            )
        )
        created.append(email)
    db.flush()
    created.extend(_seed_demo_reports(db))
    db.commit()
    return created


def _seed_demo_reports(db: Session) -> list[str]:
    reporter = db.scalar(select(User).where(User.email == DEMO_ACCOUNTS[0][1]))
    officer = db.scalar(select(User).where(User.email == DEMO_ACCOUNTS[1][1]))
    created: list[str] = []
    for demo in DEMO_REPORTS:
        year = demo.incident_date.year
        reference_no = reserve_reference_number(db, year, demo.sequence)
        if db.scalar(select(Report.id).where(Report.reference_no == reference_no)):
            continue
        report = Report(
            reference_no=reference_no,
            reporter_id=reporter.id,
            hazard_type_id=db.scalar(
                select(HazardType.id).where(HazardType.code == demo.hazard_code)
            ),
            description=demo.description,
            incident_date=demo.incident_date,
            incident_time=demo.incident_time,
            barangay_id=db.scalar(select(Barangay.id).where(Barangay.name == demo.barangay)),
            landmark=demo.landmark,
            latitude=demo.latitude,
            longitude=demo.longitude,
            location_source="gps",
            status=demo.history[-1][0] if demo.history else ReportStatus.SUBMITTED,
            is_demo=True,
            submitted_at=demo.submitted_at,
        )
        db.add(report)
        db.flush()
        db.add(
            ReportStatusHistory(
                report_id=report.id,
                from_status=None,
                to_status=ReportStatus.SUBMITTED,
                changed_by_id=reporter.id,
                changed_at=demo.submitted_at,
            )
        )
        db.add(
            Notification(
                user_id=reporter.id,
                report_id=report.id,
                kind="report_submitted",
                title="Report received",
                body=f"Report {reference_no} was submitted. MDRRMO personnel will review it.",
                created_at=demo.submitted_at,
                read_at=demo.submitted_at,
            )
        )
        previous = ReportStatus.SUBMITTED
        for step, (status, note) in enumerate(demo.history, start=1):
            changed_at = demo.submitted_at + timedelta(hours=step)
            db.add(
                ReportStatusHistory(
                    report_id=report.id,
                    from_status=previous,
                    to_status=status,
                    changed_by_id=officer.id,
                    note=note,
                    changed_at=changed_at,
                )
            )
            title, body = STATUS_MESSAGES[status]
            is_latest = demo.sequence == 123 and step == len(demo.history)
            db.add(
                Notification(
                    user_id=reporter.id,
                    report_id=report.id,
                    kind=f"status_{status.value}",
                    title=title,
                    body=body.format(ref=reference_no) + f' Note from MDRRMO: "{note}"',
                    created_at=changed_at,
                    # The newest demo notification is left unread so the badge shows.
                    read_at=None if is_latest else changed_at,
                )
            )
            previous = status
        created.append(reference_no)
    return created


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description=__doc__.split("\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)

    create = commands.add_parser("create-staff", help="Create an authorized MDRRMO account")
    create.add_argument("--email", required=True)
    create.add_argument("--name", required=True, help="Full name")
    create.add_argument("--role", choices=["mdrrmo", "admin"], default="mdrrmo")
    create.add_argument("--password-stdin", action="store_true")

    active = commands.add_parser("set-staff-active", help="Enable or disable a staff account")
    active.add_argument("--email", required=True)
    group = active.add_mutually_exclusive_group(required=True)
    group.add_argument("--active", dest="active", action="store_true")
    group.add_argument("--inactive", dest="active", action="store_false")

    commands.add_parser("seed-demo", help="Create fictional DEMO accounts (not in production)")

    args = parser.parse_args(argv)
    try:
        with Session(get_engine()) as db:
            if args.command == "create-staff":
                password = _read_password(args.password_stdin, args.email)
                user = create_staff(
                    db,
                    email=args.email,
                    full_name=args.name,
                    role=UserRole(args.role),
                    password=password,
                )
                print(f"Created {user.role.value} account for {user.email}")
            elif args.command == "set-staff-active":
                user = set_staff_active(db, email=args.email, active=args.active)
                print(f"{user.email} is now {'active' if user.is_active else 'disabled'}")
            elif args.command == "seed-demo":
                created = seed_demo(db)
                for item in created:
                    print(f"Created DEMO record {item}")
                print(f"Demo password: {DEMO_PASSWORD}" if created else "Demo accounts exist")
    except CliError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
