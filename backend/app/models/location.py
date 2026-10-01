from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Barangay(Base):
    """A barangay of Dalaguete. Centroids/boundaries are added in Phase 6."""

    __tablename__ = "barangays"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    psgc_code: Mapped[str | None] = mapped_column(String(12), unique=True)
