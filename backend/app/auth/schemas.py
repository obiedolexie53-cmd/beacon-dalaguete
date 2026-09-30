import uuid
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    ValidationInfo,
    field_validator,
    model_validator,
)

from app.auth.validation import check_password_strength, normalize_ph_mobile
from app.models import UserRole


class BarangayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str | None
    phone: str | None
    role: UserRole
    barangay: BarangayOut | None
    is_demo: bool


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr | None = None
    phone: str | None = None
    barangay_id: int
    password: str
    privacy_consent: bool

    @field_validator("full_name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Enter your full name")
        return value

    @field_validator("email", mode="before")
    @classmethod
    def _blank_email_is_none(cls, value: object) -> object:
        return value.strip().lower() or None if isinstance(value, str) else value

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return normalize_ph_mobile(value)

    @field_validator("privacy_consent")
    @classmethod
    def _consent_required(cls, value: bool) -> bool:
        if not value:
            raise ValueError("You must agree to the privacy notice to create an account")
        return value

    @field_validator("password")
    @classmethod
    def _strong_password(cls, value: str, info: ValidationInfo) -> str:
        # email and phone are declared earlier, so they are already validated here.
        check_password_strength(value, identifiers=(info.data.get("email"), info.data.get("phone")))
        return value

    @model_validator(mode="after")
    def _contact_required(self) -> "RegisterRequest":
        if not self.email and not self.phone:
            raise ValueError("Provide an email address or a mobile number")
        return self


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=254, description="Email or mobile number")
    password: str = Field(min_length=1, max_length=256)


class SessionResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105
    expires_in: int
    user: UserOut
