"""Application settings, read from environment variables prefixed with BEACON_."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_DEFAULT_SECRET = "change-me-dev-only-never-use-in-production"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BEACON_", env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://beacon:beacon_dev_password@localhost:5432/beacon"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:5174"]
    )
    # Private evidence storage (never served directly by a web server).
    media_root: Path = Path("./media")
    media_url_minutes: int = 10
    secret_key: str = INSECURE_DEFAULT_SECRET

    # Authentication
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    staff_refresh_token_hours: int = 12
    # A just-rotated refresh token presented again within this window is treated as a
    # benign race (e.g. two tabs refreshing at once), not as token theft.
    refresh_reuse_grace_seconds: int = 10
    max_failed_logins: int = 5
    lockout_minutes: int = 15
    # Secure cookies need HTTPS. Defaults to on in production (see validator).
    cookie_secure: bool | None = None

    @model_validator(mode="after")
    def _production_safety(self) -> "Settings":
        if self.environment == "production":
            if self.secret_key == INSECURE_DEFAULT_SECRET or len(self.secret_key) < 32:
                raise ValueError("BEACON_SECRET_KEY must be set (32+ characters) in production")
            if self.cookie_secure is False:
                raise ValueError("BEACON_COOKIE_SECURE cannot be disabled in production")
        if self.cookie_secure is None:
            self.cookie_secure = self.environment == "production"
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
