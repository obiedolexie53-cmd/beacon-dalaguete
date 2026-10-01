import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.ratelimit import LOGIN, REGISTER, Limit, SlidingWindowLimiter


def test_sliding_window() -> None:
    limiter = SlidingWindowLimiter()
    limit = Limit("t", 3, 60)
    assert [limiter.hit(limit, "1.2.3.4", now=t) for t in (0, 1, 2)] == [None, None, None]
    assert limiter.hit(limit, "1.2.3.4", now=10) == pytest.approx(50)
    assert limiter.hit(limit, "5.6.7.8", now=10) is None  # other addresses are unaffected
    assert limiter.hit(limit, "1.2.3.4", now=60.5) is None  # the first hit has left the window


@pytest.mark.db
def test_login_is_limited_per_ip(api: TestClient) -> None:
    body = {"identifier": "nobody@example.com", "password": "wrong-password"}
    for _ in range(LOGIN.max_requests):
        assert api.post("/api/v1/auth/login", json=body).status_code == 401
    blocked = api.post("/api/v1/auth/login", json=body)
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "too_many_requests"
    assert "Too many attempts from this network" in blocked.json()["error"]["message"]
    assert 0 < int(blocked.headers["retry-after"]) <= LOGIN.window_seconds
    # Staff login shares the per-IP login budget.
    assert api.post("/api/v1/staff/auth/login", json=body).status_code == 429


@pytest.mark.db
def test_registration_is_limited_per_ip(api: TestClient) -> None:
    for _ in range(REGISTER.max_requests):
        assert api.post("/api/v1/auth/register", json={}).status_code == 422
    assert api.post("/api/v1/auth/register", json={}).status_code == 429


@pytest.mark.db
def test_limits_can_be_switched_off(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "rate_limits_enabled", False)
    body = {"identifier": "nobody@example.com", "password": "wrong-password"}
    for _ in range(LOGIN.max_requests + 2):
        assert api.post("/api/v1/auth/login", json=body).status_code == 401
