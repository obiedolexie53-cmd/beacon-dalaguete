# BEACON — Architecture Proposal (Phase 1)

**BEACON: A Community-Based Disaster Reporting and Monitoring Application with
Machine Learning-Assisted Hazard Pattern Analysis**
Municipality of Dalaguete, Cebu, Philippines

> Status: **PROPOSAL, awaiting approval.** No framework has been installed yet.
> This document records the recommended technical direction before any major
> architectural decision is locked in.

BEACON is a reporting and monitoring tool. It is **not** a disaster prediction
system. The ML component analyses *recorded* reports to surface recurring
hazard patterns; verification and all decisions remain with authorized MDRRMO
personnel.

---

## 0. Findings from inspecting the repository and environment

| Item | Finding |
|---|---|
| Repository | Empty (no commits, no existing code or conventions to follow) |
| Node.js / npm / pnpm | v22 / 10.9 / 10.33 available |
| Python | 3.11 available |
| PostgreSQL | 16 client available; Docker 29 available for a local DB |
| Flutter / Dart / Android SDK | **Not installed** |

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

| Layer | Recommendation | Reason |
|---|---|---|
| Resident app | **React + TypeScript + Vite, as a PWA** | Works on any Android or iPhone browser and installs to the home screen with no app store. Uses browser camera, video capture and Geolocation APIs. Easy to hand to evaluators with a link. Can be wrapped with **Capacitor** later if a native APK is required. |
| MDRRMO console | React + TypeScript + Vite (separate app) | Shares the design system and types with the resident app |
| Shared UI | Design tokens + component library (`packages/ui`) | One consistent design system across both apps |
| Maps | **Leaflet + OpenStreetMap** tiles | No API key or billing account needed. Good coverage of Dalaguete. |
| Charts | Recharts (or Chart.js) | Bar, line, heatmap and trend charts for pattern visualization |
| API | **Python 3.11 + FastAPI + SQLAlchemy 2 + Alembic** | Typed and fast, generates OpenAPI docs automatically. Same language as the ML stack. |
| ML / analysis | **pandas, scikit-learn** (DBSCAN with haversine distance), numpy | Standard, explainable, well-documented techniques that suit a thesis write-up |
| Database | **PostgreSQL 16 + PostGIS** | Relational integrity for reports and history. Spatial queries for maps and hotspots. |
| Media storage | Private local folder (dev) → S3-compatible bucket (deploy) | Media is only served through authenticated API endpoints |
| Auth | JWT access token + rotating refresh token (httpOnly cookie), Argon2 password hashing | See §5 |
| Testing | pytest (API/ML), Vitest + Testing Library (UI), Playwright (end-to-end) | |
| Dev environment | Docker Compose (Postgres/PostGIS), pnpm workspaces | One command to start everything locally |

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

**Status workflow** (enforced in the API; a new report always starts as
`submitted`):

```
submitted ──► under_verification ──► verified ──► resolved
     │               │    ▲
     └───────────────┴──► needs_clarification ("For Verification / Needs Clarification")
```

Only `mdrrmo` or `admin` users can change a report's status. Each change writes
a `report_status_history` row and a notification to the reporter.

---

## 5. Authentication approach

- **Residents** self-register with name, email or mobile number, password, and
  barangay, plus Data Privacy Act (RA 10173) consent.
- **MDRRMO personnel** have **no public registration.** Accounts are created
  by an admin via a CLI script or an admin-only endpoint. The resident app has
  no staff login route at all.
- Passwords are hashed with **Argon2id**. Login is rate-limited, and
  repeated failures lock the account temporarily.
- A short-lived **JWT access token** (~15 min) is kept in memory. A
  **rotating refresh token** lives in an httpOnly, Secure, SameSite cookie and
  is stored hashed in the database so it can be revoked.
- **Role-based access control** is enforced as FastAPI dependencies on every
  route:
  - `resident`: `/me/*`. Report queries are always filtered by
    `reporter_id = current_user`. Another user's report returns 404, not 403,
    so report IDs aren't leaked.
  - `mdrrmo` / `admin`: `/staff/*` monitoring, verification, map and analysis.
- **Media** is never publicly addressable. Files are streamed only after an
  ownership or role check (or through short-lived signed URLs once in object
  storage). EXIF metadata is stripped from stored photos.
- HTTPS is required in any deployment. Browsers only allow camera and GPS
  access on secure origins.

---

## 6. Main application modules

| Module | Resident | MDRRMO |
|---|---|---|
| Auth & accounts | register, login, profile | secure login (authorized accounts) |
| Reporting wizard | hazard → details → location → evidence → review → submit → confirmation | – |
| Location / GPS | current GPS, map pin, barangay, landmark, permission-denied fallback | incident map in detail view |
| Evidence | capture/select/preview/remove/replace photos and videos, safety reminder | photo/video viewer |
| Report tracking | My Reports, details, status timeline | – |
| Notifications | in-app status updates (web push optional) | – |
| Monitoring dashboard | – | totals by status, recent reports table |
| Reports & verification | – | search, filter, detail, status actions with notes, history |
| Disaster map | – | markers, filters (hazard, barangay, date, status), marker summary |
| Historical reports | – | date-range browsing and export |
| **ML-Assisted Hazard Pattern Analysis** | – | 4.1 / 4.2 / 4.3 below |

**ML-Assisted Hazard Pattern Analysis (descriptive, not predictive):**

- **4.1 Incident Data Analysis:** aggregates reports by hazard type,
  barangay, month, day-of-week and hour of day; frequency and historical
  occurrence tables.
- **4.2 Hazard Pattern Identification:**
  - Frequency ranking of hazard types and barangays.
  - **DBSCAN spatial clustering** (haversine) to find *recurring hazard
    locations*.
  - Hazard × barangay co-occurrence.
  - Temporal recurrence (e.g. months with repeated reports).
  - Trend direction within the recorded dataset (rolling counts).
- **4.3 Pattern Visualization:** bar charts, trend lines, a hazard × month
  heatmap, ranked tables, and a cluster or hotspot map layer.

By default, analysis uses **verified** reports. Staff can choose to include
unverified reports, and the page shows which dataset was analysed. All
generated text comes from templates in `wording.py`, e.g. *"Recurring landslide
incidents were identified in the recorded dataset for Barangay Mantalongon."*
The system never produces statements such as "this area will experience…".
A permanent notice states that the analysis supports, and does not replace,
MDRRMO assessment.

---

## 7. Development phases

| # | Phase | Main deliverable |
|---|---|---|
| 1 | Project structure & architecture | this document, monorepo scaffold, Docker Compose, CI lint/test |
| 2 | UI/design system & navigation | tokens (Deep Navy, Beacon Blue, Golden Amber…), components, both app shells |
| 3 | Resident authentication | register/login/refresh/logout, RBAC, MDRRMO account script |
| 4 | Resident dashboard | home, quick "Report a Disaster", recent reports |
| 5 | Disaster reporting | wizard steps 1–2, validation, draft saving |
| 6 | Location/GPS | geolocation, map pin, barangay, landmark, denied-permission state |
| 7 | Photo/video evidence | capture/select/preview/replace, upload validation, safety reminder |
| 8 | Submission & status tracking | reference number, confirmation, My Reports, notifications |
| 9 | MDRRMO dashboard | counts, recent reports table |
| 10 | Review & verification | detail view, media viewer, status workflow + history |
| 11 | Disaster map | Leaflet map, filters, marker summaries |
| 12 | Historical report analysis | historical browsing, 4.1 aggregations |
| 13 | ML-assisted pattern analysis | 4.2 clustering/frequency/trend module + tests |
| 14 | Pattern visualization | 4.3 charts, heatmaps, hotspot layer |
| 15 | Testing, security review, usability | E2E tests, access-control tests, accessibility, error/empty states |

Error and empty states (offline, failed submission, missing fields, location
denied, no reports, failed upload, session expired) are built alongside each
feature phase, not left to the end.

---

## 8. Technical requirements, accounts and credentials

**Needed for local development: none.** Everything runs locally: Postgres in
Docker, OpenStreetMap tiles, and local media storage.

**Needed later for a deployed, evaluable prototype:**

| Need | Options | Credential |
|---|---|---|
| Hosting (API + DB) | VPS, Render, Railway, Fly.io, or a municipal server | account + DB connection string |
| Front-end hosting | Netlify, Vercel, Cloudflare Pages, or same VPS | account |
| Domain + HTTPS | any registrar; Let's Encrypt | required for camera/GPS in browsers |
| Media storage | S3-compatible (Cloudflare R2, Backblaze B2, AWS S3, MinIO) | access key + secret |
| Email (password reset / verification) | SMTP (e.g. Brevo, Mailgun, Gmail SMTP) | SMTP credentials (optional) |
| Web push notifications | VAPID keys (self-generated, no account) | optional |
| SMS notifications | Semaphore, Twilio | optional, paid |
| Map tiles at scale | OSM policy is fine for a prototype; MapTiler/Stadia for heavier use | optional API key |

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

*All sample people, reports, and coordinates in this project are DEMO DATA and
do not represent actual current disasters.*
