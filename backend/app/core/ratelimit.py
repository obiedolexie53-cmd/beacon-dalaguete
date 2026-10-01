"""Per-IP rate limits for endpoints that can be abused without an account.

These sit in front of the per-account protections (login lockout after repeated
failures, the per-resident report limit). Limits are deliberately generous:
many Filipino mobile networks put thousands of subscribers behind one IP
address (carrier-grade NAT), and a barangay hall or evacuation centre may share
one connection.

The counters live in this process's memory, so they reset on restart and each
API worker keeps its own. That is enough for one server; a multi-server
deployment would move them to a shared store (e.g. Redis).

Behind a reverse proxy, start uvicorn with `--proxy-headers
--forwarded-allow-ips=<proxy address>` so the client's address is used rather
than the proxy's. X-Forwarded-For is never read directly, since anyone can
send it.
"""

import math
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Request, status

from app.core.config import get_settings
from app.core.errors import ApiError


@dataclass(frozen=True)
class Limit:
    name: str
    max_requests: int
    window_seconds: int


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[tuple[str, str], deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, limit: Limit, key: str, now: float | None = None) -> float | None:
        """Record a request. Returns seconds to wait if the limit is exceeded, else None."""
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._hits.setdefault((limit.name, key), deque())
            while hits and hits[0] <= now - limit.window_seconds:
                hits.popleft()
            if len(hits) >= limit.max_requests:
                return hits[0] + limit.window_seconds - now
            hits.append(now)
            if len(self._hits) > 50_000:  # drop idle keys so memory stays bounded
                self._prune(now)
            return None

    def _prune(self, now: float) -> None:
        for key in [k for k, v in self._hits.items() if not v or v[-1] < now - 3600]:
            del self._hits[key]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindowLimiter()

LOGIN = Limit("login", 30, 15 * 60)
REGISTER = Limit("register", 20, 60 * 60)
# Every signed-in app refreshes about every 15 minutes, so this must allow for many
# users sharing one address.
REFRESH = Limit("refresh", 1000, 15 * 60)


def rate_limit(limit: Limit) -> Callable[[Request], None]:
    """FastAPI dependency enforcing `limit` per client IP address."""

    def check(request: Request) -> None:
        if not get_settings().rate_limits_enabled:
            return
        ip = request.client.host if request.client else "unknown"
        wait = limiter.hit(limit, ip)
        if wait is not None:
            minutes = max(1, math.ceil(wait / 60))
            raise ApiError(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "too_many_requests",
                f"Too many attempts from this network. Please wait {minutes} "
                f"minute{'s' if minutes != 1 else ''} and try again.",
                headers={"Retry-After": str(math.ceil(wait))},
            )

    return check
