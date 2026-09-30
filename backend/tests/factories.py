from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Barangay, HazardType, Report, User, UserRole
from app.reports.reference import allocate_reference_number
from app.reports.workflow import ReportStatus

PASSWORD = "Safe-Pass-2026"  # noqa: S105


def barangay_id(db: Session, name: str = "Mantalongon") -> int:
    return db.scalar(select(Barangay.id).where(Barangay.name == name))


def make_user(
    db: Session,
    *,
    role: UserRole = UserRole.RESIDENT,
    email: str | None = "resident@example.com",
    phone: str | None = None,
    password: str = PASSWORD,
    is_active: bool = True,
) -> User:
    user = User(
        full_name="Test User",
        email=email,
        phone=phone,
        password_hash=hash_password(password),
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    return user


def registration(db: Session, **overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "full_name": "Leona Legaspi",
        "email": "leona@example.com",
        "phone": "0917 123 4567",
        "barangay_id": barangay_id(db),
        "password": PASSWORD,
        "privacy_consent": True,
    }
    body.update(overrides)
    return body


def make_report(
    db: Session,
    reporter: User,
    *,
    status: ReportStatus | None = None,
    hazard_code: str = "flood",
    submitted_at: datetime | None = None,
) -> Report:
    report = Report(
        reference_no=allocate_reference_number(db, 2026),
        reporter_id=reporter.id,
        hazard_type_id=db.scalar(select(HazardType.id).where(HazardType.code == hazard_code)),
        description="Test incident",
        incident_date=date(2026, 9, 1),
        barangay_id=barangay_id(db),
        status=status or ReportStatus.SUBMITTED,
        submitted_at=submitted_at or datetime.now(UTC),
    )
    db.add(report)
    db.commit()
    return report
