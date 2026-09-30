import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("BEACON_ENVIRONMENT", "test")

from app.main import create_app  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())
