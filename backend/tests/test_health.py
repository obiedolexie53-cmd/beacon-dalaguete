import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core.db import get_db
from app.main import create_app


def test_health_reports_ok(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_db_returns_503_when_database_unreachable() -> None:
    class BrokenSession:
        def execute(self, *_args: object) -> None:
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    app = create_app()
    app.dependency_overrides[get_db] = lambda: BrokenSession()
    response = TestClient(app).get("/api/v1/health/db")
    assert response.status_code == 503


@pytest.mark.db
@pytest.mark.skipif("BEACON_DATABASE_URL" not in os.environ, reason="no database configured")
def test_health_db_reaches_real_database(client: TestClient) -> None:
    response = client.get("/api/v1/health/db")
    assert response.status_code == 200
    assert response.json()["database"] == "reachable"


def test_production_requires_secret_key(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import Settings

    monkeypatch.delenv("BEACON_SECRET_KEY", raising=False)
    with pytest.raises(ValueError, match="BEACON_SECRET_KEY"):
        Settings(environment="production", _env_file=None)
