# BEACON

**A Community-Based Disaster Reporting and Monitoring Application with Machine
Learning-Assisted Hazard Pattern Analysis**
Municipality of Dalaguete, Cebu, Philippines

BEACON lets community residents report disaster incidents directly to
authorized personnel of the Municipal Disaster Risk Reduction and Management
Office (MDRRMO). MDRRMO staff review, verify, monitor and analyse the recorded
reports.

BEACON is **not** a disaster prediction system. Its ML-assisted component
identifies recurring hazard patterns in _recorded_ reports. Verification and
all decisions remain with MDRRMO personnel.

## Status

All 15 phases complete: project structure, design system and navigation,
resident/staff authentication, the resident dashboard, the complete reporting
flow (hazard type, incident details, location with GPS and map, photo/video
evidence, review and submission), report details with status history, in-app
notifications, the MDRRMO monitoring dashboard, report search, review and
verification, the disaster map, and historical reports: importing past MDRRMO
records, Incident Data Analysis (4.1) and CSV export, and ML-assisted Hazard
Pattern Identification (4.2): recurring locations, DBSCAN hotspots, seasonal
patterns, trends and hazards recorded together, with Pattern Visualization
(4.3): a hotspot map, heatmap tables and a trend chart. Phase 15 added
end-to-end and accessibility tests, a security review (per-IP rate limits,
video metadata removal, security headers, an access-control test over every
API route) and a usability evaluation plan.
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the approved architecture
and phase plan, and [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) for
the design system, [`docs/SECURITY.md`](docs/SECURITY.md) for security
controls and the deployment checklist, and [`docs/TESTING.md`](docs/TESTING.md)
for the tests and usability evaluation plan.

## Repository layout

| Path                 | Contents                                                     |
| -------------------- | ------------------------------------------------------------ |
| `apps/resident`      | Resident PWA (React + TypeScript + Vite), mobile-first       |
| `apps/mdrrmo`        | MDRRMO console (React + TypeScript + Vite), staff only       |
| `packages/shared`    | Shared domain constants: hazards, status workflow, ref. nos. |
| `packages/ui`        | Design system: tokens, styles, React components              |
| `packages/auth`      | Shared React sign-in state (AuthProvider, useAuth)           |
| `backend`            | FastAPI API, Alembic migrations, seed data, tests            |
| `e2e`                | End-to-end and accessibility tests (Playwright + axe-core)   |
| `docker-compose.yml` | PostgreSQL + PostGIS (and optionally the API) for local dev  |

## Development

Requirements: Node.js 22+, pnpm 10, Python 3.11+, [uv](https://docs.astral.sh/uv/), Docker,
and ffmpeg (removes location metadata from uploaded videos).

```bash
# 1. Database (PostgreSQL 16 + PostGIS)
cp .env.example .env
docker compose up -d db

# 2. API → http://localhost:8000/api/docs
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload

# 3. Front ends (from the repository root, in separate terminals)
pnpm install
pnpm dev:resident   # http://localhost:5173
pnpm dev:mdrrmo     # http://localhost:5174
```

The Vite dev servers proxy `/api` to the API on port 8000.

### Accounts

Residents register in the resident app. **MDRRMO accounts cannot be registered
publicly.** An administrator creates them with the CLI (the password is typed at
a hidden prompt):

```bash
cd backend
uv run python -m app.cli create-staff --email officer@example.gov.ph --name "Juan Dela Cruz"
uv run python -m app.cli create-staff --email admin@example.gov.ph --name "..." --role admin
uv run python -m app.cli set-staff-active --email officer@example.gov.ph --inactive
```

For local development and walkthroughs, `uv run python -m app.cli seed-demo`
creates two fictional **DEMO** accounts and two DEMO reports for Leona
(`BEA-2026-000123`, `BEA-2026-000087`). It is refused in production. Both
accounts use the password `BeaconDemo-2026`:

| Account                            | App            |
| ---------------------------------- | -------------- |
| `leona.legaspi@demo.beacon.local`  | Resident app   |
| `mdrrmo.officer@demo.beacon.local` | MDRRMO console |

`uv run python -m app.cli seed-demo-history` adds about 200 **invented** DEMO
incident records (numbered `IMP-YYYY-NNNNNN`) so the Historical Reports page
has something to analyse. Their seasonal patterns and locations are made up,
not real MDRRMO data.

### Importing MDRRMO records

Past incidents from MDRRMO files are imported from CSV by an administrator.
Start from [`docs/templates/mdrrmo_records_template.csv`](docs/templates/mdrrmo_records_template.csv)
and delete its example rows. Nothing is saved if any row has a problem, and the
command lists every problem by row:

```bash
cd backend
uv run python -m app.cli import-records records.csv --by officer@example.gov.ph --dry-run
uv run python -m app.cli import-records records.csv --by officer@example.gov.ph
uv run python -m app.cli list-imports
uv run python -m app.cli delete-import <batch id>   # undo an import
```

### Checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build   # front end
cd backend && uv run ruff check . && uv run pytest        # back end
pnpm test:e2e     # end-to-end + accessibility (Playwright; needs PostgreSQL)
```

CI (`.github/workflows/ci.yml`) runs the same checks, including migrations
against a PostGIS database and a build of the API Docker image.

## Demo data notice

All sample users, reports, and coordinates in this repository (e.g. resident
"Leona Legaspi", report `BEA-2026-000123`) are **fictional DEMO DATA** and do
not represent actual disasters.
