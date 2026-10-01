"""Auth endpoints.

Residents: /api/v1/auth/*        (public registration: resident accounts only)
Staff:     /api/v1/staff/auth/*  (no registration; accounts are created by an admin)

The refresh token lives in an httpOnly, SameSite=Strict cookie scoped to the
auth path, so page scripts can never read it. The short-lived access token is
returned in the body and kept in memory by the client.
"""

from fastapi import APIRouter, Depends, Request, Response, status

from app.auth.deps import CurrentResident, CurrentStaff, DbSession, client_ip
from app.auth.schemas import LoginRequest, RegisterRequest, SessionResponse, UserOut
from app.auth.service import (
    REFRESH_IN_PROGRESS,
    IssuedSession,
    authenticate,
    issue_session,
    register_resident,
    revoke_session,
    rotate_session,
)
from app.core.config import get_settings
from app.core.errors import ApiError, error_response
from app.core.ratelimit import LOGIN, REFRESH, REGISTER, rate_limit
from app.core.security import Audience

RESIDENT_COOKIE = ("beacon_rt", "/api/v1/auth")
STAFF_COOKIE = ("beacon_staff_rt", "/api/v1/staff/auth")


def _set_refresh_cookie(
    response: Response, cookie: tuple[str, str], session: IssuedSession
) -> None:
    name, path = cookie
    response.set_cookie(
        name,
        session.refresh_token,
        max_age=session.refresh_max_age,
        path=path,
        httponly=True,
        secure=bool(get_settings().cookie_secure),
        samesite="strict",
    )


def _clear_refresh_cookie(response: Response, cookie: tuple[str, str]) -> None:
    name, path = cookie
    response.delete_cookie(
        name, path=path, httponly=True, secure=bool(get_settings().cookie_secure), samesite="strict"
    )


def _session_body(session: IssuedSession) -> SessionResponse:
    return SessionResponse(
        access_token=session.access_token,
        expires_in=session.expires_in,
        user=UserOut.model_validate(session.user),
    )


def _build_router(audience: Audience, cookie: tuple[str, str]) -> APIRouter:
    router = APIRouter()

    @router.post(
        "/login", response_model=SessionResponse, dependencies=[Depends(rate_limit(LOGIN))]
    )
    def login(body: LoginRequest, request: Request, response: Response, db: DbSession):
        user = authenticate(db, body.identifier, body.password, audience, client_ip(request))
        session = issue_session(db, user, audience, request.headers.get("user-agent"))
        _set_refresh_cookie(response, cookie, session)
        return _session_body(session)

    @router.post(
        "/refresh", response_model=SessionResponse, dependencies=[Depends(rate_limit(REFRESH))]
    )
    def refresh(request: Request, response: Response, db: DbSession):
        try:
            session = rotate_session(
                db,
                request.cookies.get(cookie[0]),
                audience,
                request.headers.get("user-agent"),
                client_ip(request),
            )
        except ApiError as exc:
            # Build the error response here so a dead cookie can also be cleared.
            failed = error_response(exc)
            if exc is not REFRESH_IN_PROGRESS:
                _clear_refresh_cookie(failed, cookie)
            return failed
        _set_refresh_cookie(response, cookie, session)
        return _session_body(session)

    @router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
    def logout(request: Request, response: Response, db: DbSession) -> None:
        revoke_session(db, request.cookies.get(cookie[0]), client_ip(request))
        _clear_refresh_cookie(response, cookie)

    return router


resident_auth_router = _build_router("resident", RESIDENT_COOKIE)
staff_auth_router = _build_router("staff", STAFF_COOKIE)


@resident_auth_router.post(
    "/register",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(REGISTER))],
)
def register(body: RegisterRequest, request: Request, response: Response, db: DbSession):
    user = register_resident(db, body, client_ip(request))
    session = issue_session(db, user, "resident", request.headers.get("user-agent"))
    _set_refresh_cookie(response, RESIDENT_COOKIE, session)
    return _session_body(session)


me_router = APIRouter()


@me_router.get("/me", response_model=UserOut, tags=["resident"])
def resident_me(user: CurrentResident) -> UserOut:
    return UserOut.model_validate(user)


@me_router.get("/staff/me", response_model=UserOut, tags=["staff"])
def staff_me(user: CurrentStaff) -> UserOut:
    return UserOut.model_validate(user)
