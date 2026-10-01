"""Consistent error responses: {"error": {"code", "message", "fields"}}.

Clients switch on `code` and may show `message` directly to users, so messages
are written in plain language.
"""

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        fields: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = fields
        self.headers = headers


def _body(code: str, message: str, fields: dict[str, str] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if fields:
        error["fields"] = fields
    return {"error": error}


def _field_name(loc: tuple[Any, ...]) -> str:
    parts = [str(p) for p in loc if p not in ("body", "query", "path")]
    return ".".join(parts) or "request"


def _clean_message(msg: str) -> str:
    # Pydantic prefixes custom validator messages with "Value error, ".
    return msg.removeprefix("Value error, ")


def error_response(exc: ApiError) -> JSONResponse:
    return JSONResponse(
        _body(exc.code, exc.message, exc.fields), exc.status_code, headers=exc.headers
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return error_response(exc)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, str] = {}
        for err in exc.errors():
            fields.setdefault(_field_name(tuple(err["loc"])), _clean_message(err["msg"]))
        return JSONResponse(
            _body("validation_error", "Please check the highlighted fields.", fields),
            status.HTTP_422_UNPROCESSABLE_CONTENT,
        )
