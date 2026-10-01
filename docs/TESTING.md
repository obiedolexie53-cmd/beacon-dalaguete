# BEACON testing and evaluation

## Automated tests

| Layer                    | Where                  | What it covers                                                                                                                                                                                                                     |
| ------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API (pytest)             | `backend/tests`        | Authentication, sessions and lockout, the access-control matrix, rate limits, report submission and workflow, evidence processing (EXIF and video metadata removal), staff review, map, imports, 4.1 analysis, 4.2 pattern methods |
| Front-end units (Vitest) | `packages/*`, `apps/*` | Shared rules, API client, components, every resident and console screen (including error and empty states)                                                                                                                         |
| End-to-end (Playwright)  | `e2e/tests`            | Both built apps against a real API and database (below)                                                                                                                                                                            |
| Accessibility (axe-core) | `e2e/tests`            | Every screen visited by the end-to-end tests, checked against WCAG 2.1 A and AA; serious or critical problems fail the run                                                                                                         |

### Running them

```bash
pnpm lint && pnpm typecheck && pnpm test           # front-end checks and unit tests
cd backend && uv run ruff check . && uv run pytest  # API tests (needs PostgreSQL)
pnpm test:e2e                                      # builds both apps, then runs Playwright
```

The API tests use a separate `<database>_test` database, created and migrated
automatically. Video tests need `ffmpeg` installed (they are skipped without
it).

The end-to-end tests start their own API on port 8100 and the two apps on
4183 and 4184, against a database named `beacon_e2e`. That database is deleted
and rebuilt with the DEMO accounts, reports and generated history at the start
of every run; the script refuses to reset a database whose name does not end
in `_e2e`. Set `E2E_DATABASE_URL` to use another server, and `E2E_CHROMIUM` to
use an already-installed Chromium instead of Playwright's own. CI runs all of
these, including the end-to-end job.

### End-to-end scenarios

Resident app (phone-sized screen):

- A resident logs in, reports a flood (hazard, details, GPS location,
  barangay, landmark, photo), reviews and submits it, sees the reference
  number, the report details with its photo and status history, and finds it
  in My Reports, Notifications and Profile. Every step is checked with axe.
- The connection drops when submitting: "Report Not Submitted" and "Please
  check your connection and try again." appear, the report is kept, and it is
  sent once the connection returns.
- Location permission is refused: the "Location permission denied" guidance
  appears.
- Welcome, login and registration pages pass the accessibility check, and
  buttons, links and form controls on the main screens are at least 44 × 44 px.

MDRRMO console (desktop):

- An officer finds a newly submitted report, reviews the reporter and
  incident, moves it to Under Verification, then Verified with a note, and
  the resident receives the "Report verified" notification.
- Disaster map, Historical Reports (with CSV export), Pattern Analysis
  findings and the Charts and map view all load with the DEMO history and pass
  the accessibility check.
- A resident's credentials cannot open the console, a resident's token is
  refused by staff API routes, and console pages redirect to login when
  signed out.

## Required error states

| Error state (specification)                                                                       | Where it is handled                                                                           | Tested by                                 |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| No internet connection                                                                            | Offline banner in both apps (`OfflineBanner`); drafts stay on the device                      | UI unit tests; E2E offline submission     |
| Failed report submission ("Report Not Submitted" / "Please check your connection and try again.") | Review step (`ReviewStep.tsx`), report kept as a draft                                        | Resident unit tests; E2E                  |
| Missing required information                                                                      | Inline field errors on every step, and links back to the step if the server rejects a field   | Resident unit tests; API validation tests |
| Location permission denied                                                                        | `GeolocationMessage.tsx`, with how to allow it or place a pin / give a landmark instead       | Resident unit tests; E2E                  |
| No reports yet                                                                                    | Empty states in Home and My Reports; "No reports match" in the console                        | Unit tests                                |
| Failed evidence upload                                                                            | Upload is retried from the confirmation screen; the report itself is already safe             | Resident unit tests; API media tests      |
| Session errors (expired or ended session)                                                         | Silent refresh; otherwise back to login with a "session ended" message (resident and console) | Auth unit tests; API session tests        |
| Too many attempts (added in Phase 15)                                                             | Server message with the wait time; a limited refresh does not sign the user out               | API and client tests                      |

## Usability evaluation plan

A suggested plan for the research team's evaluation with residents and MDRRMO
personnel. Use the DEMO accounts or test accounts only, never real incidents.

### Participants

- Residents of different ages and levels of experience with smartphones,
  including some from upland barangays with weaker signal.
- MDRRMO personnel who review reports.

### Resident tasks

1. Create an account and log in.
2. Report a landslide near a landmark, with the GPS location and a photo.
3. Report an incident with location permission turned off (use the landmark).
4. Submit a report while in airplane mode, then send it when back online.
5. Find a submitted report and say what its current status means.
6. Open a notification asking for more information and say what to do next.

### MDRRMO tasks

1. Find all new landslide reports from Mantalongon this month.
2. Review a report, request clarification, then verify another.
3. Find the report's location on the Disaster Map.
4. Using Historical Reports, say which hazard type was recorded most often in
   the last 12 months, and export the records.
5. Using Pattern Analysis, describe one recurring location and one seasonal
   pattern **in words that do not predict the future**.

### Measures

- Task success (completed without help / with help / not completed), time on
  task and errors.
- System Usability Scale (SUS) questionnaire after the session (a score above
  68 is above average).
- Short interview: what was confusing, what was missing, and whether
  participants understood that reports are verified by the MDRRMO and that the
  analysis does not predict disasters.

### Before the evaluation

- Replace the DEMO barangay positions and history with the official barangay
  list and real (anonymised if needed) MDRRMO records.
- Obtain consent from participants and follow the municipality's data privacy
  requirements (see [SECURITY.md](SECURITY.md)).
