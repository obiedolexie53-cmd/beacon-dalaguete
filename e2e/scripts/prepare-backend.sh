#!/usr/bin/env bash
# Rebuild the end-to-end test database from scratch: a fresh schema plus the
# fictional DEMO accounts, reports and generated history. Refuses to touch any
# database whose name does not end in "_e2e".
set -euo pipefail
cd "$(dirname "$0")/../../backend"
: "${BEACON_DATABASE_URL:?set BEACON_DATABASE_URL to the end-to-end database}"

uv run python - <<'PY'
import os
from sqlalchemy import create_engine, make_url, text

url = make_url(os.environ["BEACON_DATABASE_URL"])
if not url.database or not url.database.endswith("_e2e"):
    raise SystemExit(f"Refusing to reset {url.database!r}: the name must end in _e2e")
admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
with admin.connect() as conn:
    conn.execute(text(f'DROP DATABASE IF EXISTS "{url.database}" WITH (FORCE)'))
    conn.execute(text(f'CREATE DATABASE "{url.database}"'))
admin.dispose()
PY
uv run alembic upgrade head
uv run python -m app.cli seed-demo
uv run python -m app.cli seed-demo-history
