# BEACON — Architecture (Phase 1)

**BEACON: A Community-Based Disaster Reporting and Monitoring Application with
Machine Learning-Assisted Hazard Pattern Analysis**
Municipality of Dalaguete, Cebu, Philippines

> Status: **APPROVED (2026-09-30).** Stack: React + TypeScript PWA (resident),
> React + TypeScript web console (MDRRMO), Python FastAPI API,
> PostgreSQL + PostGIS. Phase 1 scaffold implemented.
>
> Tooling note: TypeScript is pinned to 6.0.x because typescript-eslint does
> not yet support TypeScript 7.

BEACON is a reporting and monitoring tool. It is **not** a disaster prediction
system. The ML component analyses _recorded_ reports to surface recurring
hazard patterns; verification and all decisions remain with authorized MDRRMO
personnel.

---

## 0. Findings from inspecting the repository and environment

| Item                         | Finding                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| Repository                   | Empty (no commits, no existing code or conventions to follow) |
| Node.js / npm / pnpm         | v22 / 10.9 / 10.33 available                                  |
| Python                       | 3.11 available                                                |
| PostgreSQL                   | 16 client available; Docker 29 available for a local DB       |
| Flutter / Dart / Android SDK | **Not installed**                                             |

Because the repository is empty, the architecture below is a fresh proposal.
It uses tooling that is already available so development and testing can
start immediately.

---

## 1. Recommended project architecture

A **three-tier client–server architecture** with two separate front-end apps,
one API, and one database:

```
 ┌────────────────────────┐     ┌────────────────────────┐
 │ Resident App (PWA)     │     │ MDRRMO Console (Web)   │
 │ mobile-first, install- │     │ desktop-first, staff   │
 │ able, camera + GPS     │     │ only, maps + analytics │
 └───────────┬────────────┘     └───────────┬────────────┘
             │  HTTPS / JSON (REST, OpenAPI)│
             ▼                              ▼
 ┌──────────────────────────────────────────────────────┐
 │ BEACON API (Python · FastAPI)                         │
 │ auth · reports · media · status workflow ·            │
 │ notifications · map data · analytics · ML patterns    │
 │ Role-based access enforced on every endpoint          │
 └───────────┬───────────────────────────┬──────────────┘
             ▼                           ▼
 ┌────────────────────────┐   ┌─────────────────────────┐
 │ PostgreSQL 16          │   │ Private media storage   │
 │ (+ PostGIS)            │   │ local disk (dev) →      │
 │ users, reports, history│   │ S3-compatible (deploy)  │
 └────────────────────────┘   └─────────────────────────┘
```

Why this shape:

- **Two separate front ends.** The resident app never ships MDRRMO code or
  routes, which reduces the attack surface and keeps each UI focused (mobile
  for residents, desktop tables and maps for staff).
- **One API that owns all rules.** Role checks, the status workflow, report ID
  generation and "residents see only their own reports" are enforced
  server-side, never trusted to the client.
- **ML runs inside the API process (Python).** Pattern analysis runs on the
  same data with the same access control. There is no separate ML service to
  deploy for a research prototype.

---

## 2. Recommended technology stack

| Layer           | Recommendation                                                                       | Reason                                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resident app    | **React + TypeScript + Vite, as a PWA**                                              | Works on any Android or iPhone browser and installs to the home screen with no app store. Uses browser camera, video capture and Geolocation APIs. Easy to hand to evaluators with a link. Can be wrapped with **Capacitor** later if a native APK is required. |
| MDRRMO console  | React + TypeScript + Vite (separate app)                                             | Shares the design system and types with the resident app                                                                                                                                                                                                        |
| Shared UI       | Design tokens + component library (`packages/ui`)                                    | One consistent design system across both apps                                                                                                                                                                                                                   |
| Maps            | **Leaflet + OpenStreetMap** tiles                                                    | No API key or billing account needed. Good coverage of Dalaguete.                                                                                                                                                                                               |
| Charts          | Recharts (or Chart.js)                                                               | Bar, line, heatmap and trend charts for pattern visualization                                                                                                                                                                                                   |
| API             | **Python 3.11 + FastAPI + SQLAlchemy 2 + Alembic**                                   | Typed and fast, generates OpenAPI docs automatically. Same language as the ML stack.                                                                                                                                                                            |
| ML / analysis   | **pandas, scikit-learn** (DBSCAN with haversine distance), numpy                     | Standard, explainable, well-documented techniques that suit a thesis write-up                                                                                                                                                                                   |
| Database        | **PostgreSQL 16 + PostGIS**                                                          | Relational integrity for reports and history. Spatial queries for maps and hotspots.                                                                                                                                                                            |
| Media storage   | Private local folder (dev) → S3-compatible bucket (deploy)                           | Media is only served through authenticated API endpoints                                                                                                                                                                                                        |
| Auth            | JWT access token + rotating refresh token (httpOnly cookie), Argon2 password hashing | See §5                                                                                                                                                                                                                                                          |
| Testing         | pytest (API/ML), Vitest + Testing Library (UI), Playwright (end-to-end)              |                                                                                                                                                                                                                                                                 |
| Dev environment | Docker Compose (Postgres/PostGIS), pnpm workspaces                                   | One command to start everything locally                                                                                                                                                                                                                         |

**Alternatives considered:**

- **Flutter:** good for native apps, but it isn't installed here, and the
  MDRRMO web console would need a second stack or Flutter Web.
- **Supabase / Firebase BaaS:** faster to start, but it ties the project to a
  vendor account, puts the verification rules into platform-specific policy
  code, and is harder to run offline for evaluation.

Both can be revisited if the research team prefers them.

---

## 3. Folder structure

```
beacon-dalaguete/
├── apps/
│   ├── resident/                 # Resident PWA (mobile-first)
│   │   └── src/
│   │       ├── app/              # routing, providers, layout (bottom nav)
│   │       ├── features/
│   │       │   ├── auth/         # splash, welcome, login, register
│   │       │   ├── home/         # resident dashboard
│   │       │   ├── report/       # 6-step wizard: hazard→details→location→evidence→review→submit
│   │       │   ├── my-reports/   # list + report details + status timeline
│   │       │   ├── notifications/
│   │       │   └── profile/
│   │       └── lib/              # api client, geolocation, media capture, offline draft
│   └── mdrrmo/                   # MDRRMO console (desktop-first)
│       └── src/
│           ├── app/              # routing, sidebar layout, auth guard
│           └── features/
│               ├── auth/         # staff login only (no registration)
│               ├── dashboard/    # counts + recent reports table
│               ├── reports/      # search, filter, detail, media viewer
│               ├── verification/ # status actions + history
│               ├── map/          # disaster map with filters
│               ├── history/      # historical reports
│               └── analysis/     # 4.1 / 4.2 / 4.3 ML-assisted pattern analysis
├── packages/
│   ├── ui/                       # design tokens, components, icons
│   └── shared/                   # TS types, enums (hazards, statuses), generated API client
├── backend/
│   ├── app/
│   │   ├── core/                 # config, db session, security, RBAC dependencies
│   │   ├── auth/                 # register (resident only), login, refresh, logout
│   │   ├── users/
│   │   ├── locations/            # barangays, Dalaguete boundary/demo coords
│   │   ├── reports/              # CRUD, reference-number generator, status workflow
│   │   ├── media/                # upload validation, EXIF stripping, authorized streaming
│   │   ├── notifications/
│   │   ├── monitoring/           # dashboard counts, map feed
│   │   ├── analysis/
│   │   │   ├── incident_data.py      # 4.1 Incident Data Analysis
│   │   │   ├── pattern_identification.py  # 4.2 Hazard Pattern Identification (ML)
│   │   │   ├── visualization.py      # 4.3 chart/map-ready outputs
│   │   │   └── wording.py            # enforced non-predictive language
│   │   └── audit/
│   ├── migrations/               # Alembic
│   ├── seeds/                    # DEMO DATA (Leona Legaspi, BEA-2026-000123, …)
│   ├── scripts/                  # create_mdrrmo_user.py (authorized account creation)
│   └── tests/
├── docs/                         # architecture, API, data dictionary, test plans
├── docker-compose.yml
└── README.md
```

---

## 4. Database structure

```
users
  id (uuid PK) · full_name · email (unique) · phone · password_hash
  role ENUM('resident','mdrrmo','admin') · barangay_id FK · is_active
  created_at · last_login_at

barangays                         -- 33 barangays of Dalaguete (to be confirmed against PSGC)
  id · name · psgc_code · centroid (geography Point) · boundary (geography Polygon, optional)

hazard_types                      -- extensible: new hazards can be added without code changes
  id · code · name · icon · is_active · sort_order
  seed: flood, landslide, earthquake, typhoon, storm_surge,
        strong_winds, heavy_rainfall, fire, other

reports
  id (uuid PK)
  reference_no (unique, e.g. BEA-2026-000123)     -- generated server-side per year
  reporter_id FK users
  hazard_type_id FK · other_hazard_text (when 'other')
  description
  incident_date · incident_time
  municipality ('Dalaguete') · province ('Cebu')
  barangay_id FK · landmark · location_text
  latitude · longitude · location (geography Point) · location_accuracy_m
  location_source ENUM('gps','map_pin','manual')
  status ENUM('submitted','under_verification','needs_clarification','verified','resolved')
  verified_by FK users · verified_at · verification_notes
  resolved_by FK users · resolved_at · resolution_notes
  is_demo (bool)                                  -- marks DEMO DATA
  submitted_at · updated_at

report_media
  id · report_id FK · kind ENUM('photo','video') · storage_key (private)
  mime_type · size_bytes · width · height · duration_s · sha256
  uploaded_at · removed_at

report_status_history             -- full, append-only audit of the workflow
  id · report_id FK · from_status · to_status · changed_by FK users
  note · changed_at

notifications
  id · user_id FK · report_id FK · type · title · body · read_at · created_at

refresh_tokens
  id · user_id FK · token_hash · expires_at · revoked_at · user_agent

audit_log                          -- staff access to reports/media, logins
  id · actor_id · action · entity · entity_id · ip · created_at

analysis_runs                      -- cached ML results for reproducibility
  id · run_at · params (jsonb) · dataset_filter (jsonb) · results (jsonb) · algorithm_version
```

**Implementation notes (Phase 4):**

- Reference numbers come from a `report_sequences (year, last_value)` table,
  incremented with one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`, so
  concurrent submissions never get the same number. Fixed DEMO numbers (e.g.
  `BEA-2026-000123`) are reserved, so real reports never reuse them.
- `incident_date` / `incident_time` are the local time in Dalaguete
  (Asia/Manila). `submitted_at` is a UTC timestamp shown in Philippine time.
- Coordinates are stored as `latitude` / `longitude` numerics. See the Phase 11
  notes for why no PostGIS `geography` column was added.

**Implementation notes (Phase 5):**

- `POST /api/v1/me/reports` creates a report. The server always sets the
  status (`submitted`), the reporter and the reference number, and ignores any
  such fields sent by the app. Other Hazard requires a short description. The
  incident must not be in the future (5-minute clock allowance) or more than a
  year old.
- **Idempotent submission:** each draft carries a `client_request_id`. If a
  submission is retried (e.g. the reply was lost to a dropped connection), the
  original report is returned with `200` instead of creating a duplicate.
- **Spam limit:** at most 10 reports per resident per hour (`429
too_many_reports`), with a message pointing to the MDRRMO.
- **Drafts** are saved only on the resident's device (`localStorage`, keyed by
  user). They are deleted on submission, on discard, and on logout for shared
  phones, and they are disclosed in the privacy notice.

**Implementation notes (Phase 6):**

- The location step offers three ways to locate an incident: the phone's GPS
  ("Use my current location"), tapping or dragging a pin on an OpenStreetMap
  map (Leaflet), and a nearby landmark. A barangay is always required, and
  either a map pin or a landmark must be given. Permission denied, no signal,
  timeout and non-HTTPS pages each get a clear message pointing to the map or
  landmark instead.
- Coordinates must fall inside a generous box around Dalaguete (lat 9.60–10.00,
  lng 123.30–123.70), checked in the app and by the API. The official
  municipal boundary polygon can replace this once the MDRRMO provides it.
- GPS readings less precise than 100 m are flagged so the resident can adjust
  the pin. Accuracy and the source (`gps` / `map_pin`) are stored with the report.
- Map tiles need an internet connection and are not cached by the service
  worker. OpenStreetMap's tile usage policy is fine for a research prototype;
  switch to a hosted tile provider (see §8) for wider rollout.
- Keyboard users can pan the map with the arrow keys and use "Place pin at map
  centre", since dragging a pin needs a pointer.

**Implementation notes (Phase 7):**

- Evidence is optional. Each report can have up to 5 photos and 2 videos (videos
  up to 50 MB each). Files picked in the wizard are kept on the device in
  IndexedDB with the draft, and deleted on submit, discard and logout. Photos
  are resized on the phone to at most 2048 px (JPEG) before storage, which
  saves mobile data.
- Files are uploaded one at a time _after_ the report exists:
  `POST /api/v1/me/reports/{reference_no}/media`. A failed upload can then be
  retried without resending the report. Evidence can be added while a report
  is Submitted, Under Verification or Needs Clarification.
- The server detects the real file type from its content (the file name and
  browser content type are ignored). Photos are re-encoded as JPEG (max 2560 px),
  which applies the camera rotation and removes all metadata, including EXIF
  GPS. Oversized "decompression bomb" images are refused.
- **Known limitation:** videos are stored as uploaded. Phone videos can contain
  a location tag. Removing it needs `ffmpeg` on the server, planned with the
  Phase 15 security review. Videos are only ever shown to the reporter and to
  authorized MDRRMO personnel.
- Files are stored privately (`BEACON_MEDIA_ROOT`, never served by a web server)
  and viewed through signed links that expire after 10 minutes
  (`GET /api/v1/media/{id}?exp=…&sig=…`). Links support range requests for
  video playback, and responses are `private`, `nosniff` and sandboxed.
- For deployment, the reverse proxy should cap request bodies at about 60 MB.

**Implementation notes (Phase 8):**

- **Submission** runs in two stages that can each be retried safely. First the
  report is created (the same `client_request_id` never creates a duplicate).
  Then each photo/video is uploaded and removed from the device once accepted.
  - A connection failure before the report is accepted shows "Report Not
    Submitted", and the draft is kept.
  - A failed upload leaves the report submitted and the file on the device,
    with "Retry upload" on the confirmation screen (and on the Report tab).
  - Files the server rejects (too large, wrong type) are reported and not retried.
- The resident confirms that the information is true before submitting.
- `GET /api/v1/me/reports/{reference_no}` returns the full report: status
  timeline (MDRRMO notes shown, staff names never), location and signed
  evidence links.
- **Status changes** go through `app/reports/status.py::change_status`: staff
  only, allowed transitions only, and a note is required for "Needs
  Clarification". Each change writes history, sets verification/resolution
  fields, notifies the reporter and is audited. The MDRRMO screens use it
  from Phase 10.
- **Notifications** (`/api/v1/me/notifications`) are in-app. The app polls the
  unread count every minute and when it is reopened, and shows a badge on the
  Notifications tab. Web push is an optional later addition (§8).

**Implementation notes (Phase 9):**

- `GET /api/v1/staff/dashboard` (MDRRMO/admin only) returns counts for every
  status across all residents and the 10 most recently submitted reports.
  "New" means submitted and not yet picked up for verification. The overview
  carries no reporter details; those appear only in the report review screen
  (Phase 10), where access is audited.
- `include_demo=false` leaves out fictional DEMO records, so evaluators can see
  real figures only. The console has an "Include DEMO DATA" switch, and demo
  rows are labelled.
- The dashboard refreshes itself every minute while visible, shows when it was
  last updated, and keeps the last figures on screen if a refresh fails.

**Implementation notes (Phase 10):**

- `GET /api/v1/staff/reports` searches (reference number, description,
  landmark, reporter name) and filters (status, hazard, barangay, incident date
  range, demo records), 20 per page, newest first. The console keeps filters
  in the URL, and the dashboard tiles link to the matching filtered list.
- `GET /api/v1/staff/reports/{reference_no}` returns the full report with the
  reporter's contact details, evidence, staff names in the history and the
  allowed next actions. **Every view is written to the audit log**
  (`report.viewed`), and the console reminds staff that the information is
  covered by the Data Privacy Act.
- `POST /api/v1/staff/reports/{reference_no}/status` uses `change_status`. The
  request carries the status the officer saw (`from_status`). If another
  officer changed the report in the meantime, the update is refused (`409
status_changed`) instead of silently overwriting it. The report row is locked
  during the update.
- Not included (open questions from the start of the project): an
  Invalid/Duplicate status, and in-app replies from residents to
  clarification requests. Residents are asked to contact the MDRRMO. Both can
  be added without changing the existing workflow.

**Implementation notes (Phase 11):**

- `GET /api/v1/staff/map/reports` returns the located reports that match the
  same filters as the Reports list (status, hazard, barangay, incident dates,
  demo). It carries no reporter details and caps results at 5,000 points (with
  a `truncated` flag). It also counts matching reports that have no
  coordinates, which the map lists as "no map pin" with a link to them.
- **Markers** use the status colour with the hazard icon inside and a small
  status icon badge. The status colours were checked with the dataviz palette
  validator (all pairs pass for normal vision). For colour-blind viewers, no
  five-colour set separates every pair on a map, so status is never shown by
  colour alone: markers carry the status icon, each marker's accessible name
  states hazard, status and barangay, and there is a legend, a status filter
  and a list view. Markers are keyboard-focusable (Tab, then Enter or Space).
- **No PostGIS `geography` column (a deliberate deviation from §4):** at the
  scale of one municipality (thousands of reports), filtering on the existing
  columns and drawing every point is fast, so a spatial column and index would
  add complexity without benefit. PostGIS stays enabled and can be added if
  bounding-box queries or larger areas are needed.
- Overlapping reports at the same spot are drawn on top of each other. Marker
  clustering can be added if dense areas become hard to read.

**Implementation notes (Phase 12):**

- **Two sources of records.** `reports.source` is `resident` (submitted in the
  app) or `import` (from MDRRMO files). Imported records have no reporter
  (`reporter_id` is null; a check constraint requires a reporter for resident
  reports). They are grouped in `import_batches` and carry the MDRRMO's own
  record number in `external_ref`. They use their own reference counter,
  `IMP-YYYY-NNNNNN`, so they never take numbers from `BEA-` reports
  (`report_sequences` is keyed by prefix and year). Status changes on imported
  records are recorded as usual but notify nobody.
- **CSV import** is an administrator command, not a web upload:
  `python -m app.cli import-records FILE --by STAFF_EMAIL [--dry-run]`. Every
  row is checked first and problems are listed by row and column. The import is
  all or nothing. Records are numbered in date order and each gets a status
  history entry saying which file it came from. A record number already
  imported is refused, so a file cannot be imported twice. `list-imports` and
  `delete-import BATCH_ID` show and undo imports. The template is
  [`docs/templates/mdrrmo_records_template.csv`](templates/mdrrmo_records_template.csv).
  Accepted columns: `date` (YYYY-MM-DD or MM/DD/YYYY), `time` (optional),
  `hazard` (code or name), `other_hazard` (required for Other Hazard),
  `barangay`, `description`, `landmark`, `latitude`/`longitude` (optional,
  together), `status` (Verified or Resolved, default Resolved), `external_ref`.
- **DEMO history.** `python -m app.cli seed-demo-history [--months 24]
[--seed 1] [--replace]` (refused in production) generates about 200
  **invented** records as one DEMO import batch. The seasonal patterns (rainy
  season June to December, typhoons July to November with related floods and
  landslides, landslides in upland barangays, floods and storm surge near the
  coast, more fires in March to May) and the barangay positions (upland west,
  coastal east) are made up for trying out the analysis. They are **not** real
  MDRRMO data or real barangay locations, and must be replaced with real
  records before any evaluation. The output is the same for the same seed and
  end date.
- **4.1 Incident Data Analysis.** `GET /api/v1/staff/analysis/incidents`
  counts matching records by hazard (with share), barangay (with its most
  recorded hazard), month (every month in the period), month of the year, hour
  of day (plus records with no time), weekday, hazard × barangay and hazard ×
  month of year. By default it counts reports MDRRMO verified or resolved
  (`scope=confirmed`); `scope=all` includes unverified ones. Filters: dates,
  hazard, barangay, source and demo. The output is descriptive only. The console
  page words its summary as "was recorded" or "fell in", never as a forecast.
- **CSV export.** `GET /api/v1/staff/analysis/incidents/export` returns the
  matching records with the same filters. It leaves out reporter details and
  the free-text description, which can contain personal information. Cells
  starting with `= + - @` are prefixed with `'` so spreadsheets do not run them
  as formulas. Each export is written to the audit log (`reports.exported`)
  with its filters and row count.

**Status workflow** (enforced in the API; a new report always starts as
`submitted`):

```
submitted ──► under_verification ──► verified ──► resolved
     │               │    ▲
     └───────────────┴──► needs_clarification ("For Verification / Needs Clarification")
```

Only `mdrrmo` or `admin` users can change a report's status. Each change writes
a `report_status_history` row and a notification to the reporter (imported
MDRRMO records have no reporter, so no notification).

---

## 5. Authentication approach

_Implemented in Phase 3 (`backend/app/auth`, `packages/auth`)._

- **Residents** self-register with full name, **email and/or Philippine mobile
  number** (stored as `+639XXXXXXXXX`), barangay and password. They must accept
  the Data Privacy Act (RA 10173) notice; the consent time and notice version
  are stored. They can log in with either the email or the mobile number.
  Public registration can only ever create `resident` accounts.
- **MDRRMO personnel** have **no public registration.** Accounts are created
  and disabled only through the admin CLI (`python -m app.cli create-staff` /
  `set-staff-active`). Staff passwords must be at least 12 characters. The
  resident app has no staff login at all.
- Passwords are hashed with **Argon2id**. Common and too-short passwords, and
  passwords containing the user's email or number, are rejected. After
  **5 failed attempts** an account is locked for 15 minutes. The login check
  takes the same time whether or not an account exists, and the error message
  is the same.
- **Two separate sessions:** tokens are bound to one app (`aud` = `resident` or
  `staff`). A resident token is rejected by staff routes and vice versa, and
  staff credentials do not work in the resident app.
- A short-lived **JWT access token** (15 min) is kept in memory only; nothing
  is written to `localStorage`. A **rotating refresh token** lives in an
  httpOnly, SameSite=Strict cookie scoped to the auth path (`beacon_rt` on
  `/api/v1/auth`, `beacon_staff_rt` on `/api/v1/staff/auth`). The cookie is
  `Secure` in production. Refresh tokens are stored as SHA-256 hashes and last
  14 days for residents and 12 hours for staff.
- **Stolen-token detection:** every refresh rotates the token. If an
  already-rotated token is presented again, the whole login's token family is
  revoked. A 10-second grace window, plus a cross-tab Web Lock in the client,
  stops two open tabs refreshing at once from being mistaken for theft.
- **Role-based access control** is enforced as FastAPI dependencies on every
  route. The user is re-loaded on each request, so disabling an account
  revokes access immediately.
  - `resident`: `/me` and (from Phase 5) the resident's own reports. Report
    queries are always filtered by `reporter_id = current_user`. Another
    user's report returns 404, not 403, so report IDs aren't leaked.
  - `mdrrmo` / `admin`: `/staff/*` monitoring, verification, map and analysis.
- **Audit log:** registrations, logins, failed logins, lockouts, logouts,
  token-reuse detection and staff account changes are recorded with time and
  IP address.
- **Not yet implemented:** self-service password reset (needs an SMTP or SMS
  provider, see §8; residents are told to contact the MDRRMO for now) and
  per-IP rate limiting (to be configured at the reverse proxy for deployment,
  Phase 15).
- **Media** is never publicly addressable. Files are streamed only after an
  ownership or role check (or through short-lived signed URLs once in object
  storage). EXIF metadata is stripped from stored photos.
- HTTPS is required in any deployment. Browsers only allow camera and GPS
  access on secure origins.

---

## 6. Main application modules

| Module                                  | Resident                                                                 | MDRRMO                                                            |
| --------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Auth & accounts                         | register, login, profile                                                 | secure login (authorized accounts)                                |
| Reporting wizard                        | hazard → details → location → evidence → review → submit → confirmation  | –                                                                 |
| Location / GPS                          | current GPS, map pin, barangay, landmark, permission-denied fallback     | incident map in detail view                                       |
| Evidence                                | capture/select/preview/remove/replace photos and videos, safety reminder | photo/video viewer                                                |
| Report tracking                         | My Reports, details, status timeline                                     | –                                                                 |
| Notifications                           | in-app status updates (web push optional)                                | –                                                                 |
| Monitoring dashboard                    | –                                                                        | totals by status, recent reports table                            |
| Reports & verification                  | –                                                                        | search, filter, detail, status actions with notes, history        |
| Disaster map                            | –                                                                        | markers, filters (hazard, barangay, date, status), marker summary |
| Historical reports                      | –                                                                        | date-range browsing and export                                    |
| **ML-Assisted Hazard Pattern Analysis** | –                                                                        | 4.1 / 4.2 / 4.3 below                                             |

**ML-Assisted Hazard Pattern Analysis (descriptive, not predictive):**

- **4.1 Incident Data Analysis:** aggregates reports by hazard type,
  barangay, month, day-of-week and hour of day; frequency and historical
  occurrence tables.
- **4.2 Hazard Pattern Identification:**
  - Frequency ranking of hazard types and barangays.
  - **DBSCAN spatial clustering** (haversine) to find _recurring hazard
    locations_.
  - Hazard × barangay co-occurrence.
  - Temporal recurrence (e.g. months with repeated reports).
  - Trend direction within the recorded dataset (rolling counts).
- **4.3 Pattern Visualization:** bar charts, trend lines, a hazard × month
  heatmap, ranked tables, and a cluster or hotspot map layer.

By default, analysis uses **verified** reports. Staff can choose to include
unverified reports, and the page shows which dataset was analysed. All
generated text comes from templates in `wording.py`, e.g. _"Recurring landslide
incidents were identified in the recorded dataset for Barangay Mantalongon."_
The system never produces statements such as "this area will experience…".
A permanent notice states that the analysis supports, and does not replace,
MDRRMO assessment.

---

## 7. Development phases

| #   | Phase                               | Main deliverable                                                            |
| --- | ----------------------------------- | --------------------------------------------------------------------------- |
| 1   | Project structure & architecture    | this document, monorepo scaffold, Docker Compose, CI lint/test              |
| 2   | UI/design system & navigation       | tokens (Deep Navy, Beacon Blue, Golden Amber…), components, both app shells |
| 3   | Resident authentication             | register/login/refresh/logout, RBAC, MDRRMO account script                  |
| 4   | Resident dashboard                  | home, quick "Report a Disaster", recent reports                             |
| 5   | Disaster reporting                  | wizard steps 1–2, validation, draft saving                                  |
| 6   | Location/GPS                        | geolocation, map pin, barangay, landmark, denied-permission state           |
| 7   | Photo/video evidence                | capture/select/preview/replace, upload validation, safety reminder          |
| 8   | Submission & status tracking        | reference number, confirmation, My Reports, notifications                   |
| 9   | MDRRMO dashboard                    | counts, recent reports table                                                |
| 10  | Review & verification               | detail view, media viewer, status workflow + history                        |
| 11  | Disaster map                        | Leaflet map, filters, marker summaries                                      |
| 12  | Historical report analysis          | record import, DEMO history, 4.1 aggregations, CSV export                   |
| 13  | ML-assisted pattern analysis        | 4.2 clustering/frequency/trend module + tests                               |
| 14  | Pattern visualization               | 4.3 charts, heatmaps, hotspot layer                                         |
| 15  | Testing, security review, usability | E2E tests, access-control tests, accessibility, error/empty states          |

Error and empty states (offline, failed submission, missing fields, location
denied, no reports, failed upload, session expired) are built alongside each
feature phase, not left to the end.

---

## 8. Technical requirements, accounts and credentials

**Needed for local development: none.** Everything runs locally: Postgres in
Docker, OpenStreetMap tiles, and local media storage.

**Needed later for a deployed, evaluable prototype:**

| Need                                  | Options                                                             | Credential                          |
| ------------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| Hosting (API + DB)                    | VPS, Render, Railway, Fly.io, or a municipal server                 | account + DB connection string      |
| Front-end hosting                     | Netlify, Vercel, Cloudflare Pages, or same VPS                      | account                             |
| Domain + HTTPS                        | any registrar; Let's Encrypt                                        | required for camera/GPS in browsers |
| Media storage                         | S3-compatible (Cloudflare R2, Backblaze B2, AWS S3, MinIO)          | access key + secret                 |
| Email (password reset / verification) | SMTP (e.g. Brevo, Mailgun, Gmail SMTP)                              | SMTP credentials (optional)         |
| Web push notifications                | VAPID keys (self-generated, no account)                             | optional                            |
| SMS notifications                     | Semaphore, Twilio                                                   | optional, paid                      |
| Map tiles at scale                    | OSM policy is fine for a prototype; MapTiler/Stadia for heavier use | optional API key                    |

Secrets go in `.env` files that are never committed. `.env.example` files
document each variable.

**Compliance note:** because BEACON collects personal data and locations of
Filipino residents, the prototype should include a privacy notice and consent
screen aligned with the **Data Privacy Act of 2012 (RA 10173)**.

---

## 9. Open questions for the research team

1. Is a browser-installable **PWA** acceptable for resident evaluation, or is
   a **native Android APK** required? (If an APK is required, Capacitor wraps
   the same code.)
2. Should MDRRMO be able to mark a report as **Invalid/Duplicate**? This is
   not in the current workflow, but it is useful for false or duplicate
   reports.
3. Should residents be able to reply when a report is marked **Needs
   Clarification**?
4. Where will the prototype be hosted for evaluation (municipal server or
   cloud)?
5. Can the MDRRMO provide the official barangay list, PSGC codes and
   (optionally) boundary files? Until then, DEMO coordinates are used.

---

_All sample people, reports, and coordinates in this project are DEMO DATA and
do not represent actual current disasters._
