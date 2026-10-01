import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, make_url, text
from sqlalchemy.orm import Session

os.environ.setdefault("BEACON_ENVIRONMENT", "test")

HAS_DB = "BEACON_DATABASE_URL" in os.environ

# Tests never touch the development database: they use "<name>_test" on the same
# server, created and migrated automatically at the start of the run.
if HAS_DB:
    _dev_url = make_url(os.environ["BEACON_DATABASE_URL"])
    _test_url = _dev_url.set(database=f"{_dev_url.database}_test")
    os.environ["BEACON_DATABASE_URL"] = _test_url.render_as_string(hide_password=False)

from app.core.db import get_db, get_engine  # noqa: E402
from app.core.ratelimit import limiter  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_rate_limits() -> Iterator[None]:
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture(scope="session", autouse=True)
def _test_database() -> None:
    if not HAS_DB:
        return
    admin = create_engine(_dev_url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": _test_url.database}
        )
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{_test_url.database}"'))
    admin.dispose()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(config, "head")


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


@pytest.fixture
def db() -> Iterator[Session]:
    """A session inside a transaction that is rolled back after the test.

    Code under test may call commit(); with create_savepoint those commits only
    release savepoints, so nothing persists between tests.
    """
    if not HAS_DB:
        pytest.skip("BEACON_DATABASE_URL not set (run `docker compose up -d db` and migrate)")
    connection = get_engine().connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def api(db: Session) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    return TestClient(app)
