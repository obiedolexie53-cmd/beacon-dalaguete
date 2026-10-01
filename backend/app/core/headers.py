"""Security headers on every API response.

The API only returns JSON and evidence files, so it can use a strict policy.
Routes that need something else (e.g. cacheable media) set their own values,
which are kept.
"""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

API_HEADERS = {
    b"x-content-type-options": b"nosniff",
    b"referrer-policy": b"no-referrer",
    b"x-frame-options": b"DENY",
    b"cross-origin-opener-policy": b"same-origin",
    b"cross-origin-resource-policy": b"same-origin",
    b"permissions-policy": b"camera=(), microphone=(), geolocation=()",
    # Responses carry personal data: never store them in shared caches.
    b"cache-control": b"no-store",
    b"content-security-policy": b"default-src 'none'; frame-ancestors 'none'",
}
DOCS_PATH = "/api/docs"
HSTS = (b"strict-transport-security", b"max-age=31536000; includeSubDomains")


class SecurityHeadersMiddleware:
    """Pure ASGI middleware (does not buffer streamed file responses)."""

    def __init__(self, app: ASGIApp, *, hsts: bool = False) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {name.lower() for name, _ in headers}
                extra = dict(API_HEADERS)
                if scope["path"].startswith(DOCS_PATH):
                    # Development-only Swagger UI loads its own scripts and styles.
                    del extra[b"content-security-policy"]
                if self.hsts:
                    extra[HSTS[0]] = HSTS[1]
                headers += [(k, v) for k, v in extra.items() if k not in present]
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)
