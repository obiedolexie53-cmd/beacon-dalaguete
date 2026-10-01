import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cli import CliError, create_staff, seed_demo, set_staff_active
from app.core.config import get_settings
from app.models import AuditLog, User, UserRole

pytestmark = pytest.mark.db

STRONG = "Officer-Pass-2026"  # noqa: S105


def test_create_staff_account(db: Session) -> None:
    user = create_staff(
        db,
        email="Officer@Example.gov.ph",
        full_name="  Juan  Dela Cruz ",
        role=UserRole.MDRRMO,
        password=STRONG,
    )
    assert user.email == "officer@example.gov.ph"
    assert user.full_name == "Juan Dela Cruz"
    assert user.role is UserRole.MDRRMO
    assert db.scalar(select(AuditLog).where(AuditLog.action == "account.staff_created"))


def test_create_staff_rejects_resident_role_and_duplicates(db: Session) -> None:
    with pytest.raises(CliError):
        create_staff(
            db, email="a@example.com", full_name="A", role=UserRole.RESIDENT, password=STRONG
        )
    create_staff(db, email="a@example.com", full_name="A", role=UserRole.ADMIN, password=STRONG)
    with pytest.raises(CliError, match="already exists"):
        create_staff(
            db, email="a@example.com", full_name="A", role=UserRole.MDRRMO, password=STRONG
        )


def test_deactivate_staff(db: Session) -> None:
    create_staff(db, email="a@example.com", full_name="A", role=UserRole.MDRRMO, password=STRONG)
    assert set_staff_active(db, email="a@example.com", active=False).is_active is False


def test_seed_demo_creates_labelled_demo_accounts(db: Session) -> None:
    created = seed_demo(db)
    assert "leona.legaspi@demo.beacon.local" in created
    leona = db.scalar(select(User).where(User.email == "leona.legaspi@demo.beacon.local"))
    assert leona.is_demo and leona.role is UserRole.RESIDENT
    assert leona.barangay.name == "Mantalongon"
    assert seed_demo(db) == []  # idempotent


def test_seed_demo_refuses_production(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "environment", "production")
    with pytest.raises(CliError, match="production"):
        seed_demo(db)
