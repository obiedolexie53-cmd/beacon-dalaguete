import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.location import Barangay


class UserRole(StrEnum):
    RESIDENT = "resident"
    MDRRMO = "mdrrmo"
    ADMIN = "admin"


STAFF_ROLES = frozenset({UserRole.MDRRMO, UserRole.ADMIN})


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("email IS NOT NULL OR phone IS NOT NULL", name="contact_required"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column(String(120))
    # Residents may register with an email, a mobile number, or both.
    email: Mapped[str | None] = mapped_column(String(254), unique=True)
    phone: Mapped[str | None] = mapped_column(String(16), unique=True)  # E.164, e.g. +639171234567
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e])
    )
    barangay_id: Mapped[int | None] = mapped_column(ForeignKey("barangays.id"))
    is_active: Mapped[bool] = mapped_column(default=True)
    is_demo: Mapped[bool] = mapped_column(default=False)

    privacy_consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    privacy_consent_version: Mapped[str | None] = mapped_column(String(20))

    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    barangay: Mapped[Barangay | None] = relationship(lazy="joined")

    @property
    def is_staff(self) -> bool:
        return self.role in STAFF_ROLES


class RefreshToken(Base):
    """Opaque refresh token, stored only as a SHA-256 hash.

    Tokens rotate on every use. All tokens from one login share a family_id, so
    if a revoked token is presented again (likely stolen), the whole family is
    revoked.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    family_id: Mapped[uuid.UUID] = mapped_column(index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user_agent: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship()
