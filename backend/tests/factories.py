from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Barangay, User, UserRole

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
