# BEACON security

BEACON stores residents' personal information, their reports, photos, videos
and locations. This document lists how they are protected, what the Phase 15
review found and changed, how to deploy safely, and the risks that remain.

## Controls

| Area                          | Control                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts                      | Passwords hashed with Argon2id; strength rules; the account locks for 15 minutes after 5 failed logins; login takes the same time whether or not the account exists.                                                                                                                                                                                                      |
| MDRRMO accounts               | No public registration. Created and disabled only with the administrator CLI. A disabled account loses access on its next request.                                                                                                                                                                                                                                        |
| Sessions                      | 15-minute access tokens kept in memory (never in browser storage), bound to one app (`aud` resident or staff). Refresh tokens are rotated on every use and kept in httpOnly, SameSite=Strict cookies, scoped to each app's auth path (Secure in production). Reusing an old refresh token revokes the whole session family.                                               |
| Role-based access             | Every route declares who may call it. `tests/test_access_control.py` checks every API operation (from the OpenAPI schema) with no token, an invalid token, two residents and an officer, and fails if a new route is not classified.                                                                                                                                      |
| Residents' data               | Residents see only their own reports, evidence and notifications. Another resident's reference number returns 404, so it is not even confirmed to exist.                                                                                                                                                                                                                  |
| Staff access to personal data | Each staff view of a report (with the reporter's details) is written to the audit log, as are status changes, imports and CSV exports.                                                                                                                                                                                                                                    |
| Evidence files                | Type detected from content, never from the file name. Photos are re-encoded (removes EXIF, including GPS). Videos are remuxed with ffmpeg without location, device and time metadata, data tracks or chapters, and files that are not really videos are refused. Files are stored outside the web root and served only through signed links that expire after 10 minutes. |
| Abuse limits                  | Per IP address: 30 logins per 15 minutes (resident and staff together), 20 registrations per hour, 1,000 session refreshes per 15 minutes. Per resident: 10 reports per hour; 5 photos and 2 videos per report.                                                                                                                                                           |
| HTTP headers                  | Every API response: `Cache-Control: no-store`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, cross-origin isolation headers; HSTS in production. Evidence files are additionally sandboxed.                                                          |
| Offline storage               | Report drafts (and their photos/videos) stay on the resident's device until submitted, and are deleted on submit, discard and logout. The service worker caches only the app's own files, never API responses.                                                                                                                                                            |
| Exports                       | The CSV export leaves out reporter details and free-text descriptions, and neutralises cells that spreadsheets would run as formulas.                                                                                                                                                                                                                                     |
| Production settings           | The API refuses to start in production without a 32+ character secret key or with insecure cookies. Interactive API docs are disabled in production.                                                                                                                                                                                                                      |

## Phase 15 review: findings and changes

| Finding                                                                                                                                   | Change                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Videos were stored as uploaded, so a phone's location tag could reach MDRRMO staff and remain on disk.                                    | Videos are remuxed with ffmpeg without metadata (tests embed a location tag and check it is gone). In production, video upload stops if ffmpeg is missing. |
| Only per-account limits existed; repeated logins or registrations from one address were not slowed down.                                  | Per-IP limits with `429` and `Retry-After`. A limited session refresh no longer signs the user out.                                                        |
| API responses had no security headers or caching rules (personal data could be kept by shared caches).                                    | Security headers middleware on every response, including errors.                                                                                           |
| Hotspot map labels were passed to Leaflet as strings, which Leaflet inserts as HTML.                                                      | Labels are text nodes; a test uses a hazard name containing markup.                                                                                        |
| Access rules were tested route by route, so a new route could be added without a check.                                                   | Access-control matrix over every API operation.                                                                                                            |
| Accessibility scans found wide tables that keyboard users could not scroll, and a map region marked as an image while containing buttons. | Scrollable tables become labelled, focusable regions; the map is a labelled region.                                                                        |

Accepted as designed: registration says when an email or mobile number already
has an account (helping residents who forgot they registered matters more
here; the per-IP limit slows down anyone checking many addresses).

## Deployment checklist

1. Serve both apps and the API over HTTPS from one origin, with `/api`
   proxied to the API (the apps expect same-origin API calls).
2. Set `BEACON_ENVIRONMENT=production` and a random `BEACON_SECRET_KEY` of at
   least 32 characters, kept out of the repository.
3. Set `FORWARDED_ALLOW_IPS` to the reverse proxy's address so rate limits and
   audit logs see the real client IP (`X-Forwarded-For` from anyone else is
   ignored).
4. Keep `BEACON_MEDIA_ROOT` on a private, backed-up volume that is not served
   by the web server.
5. Use the API Docker image (it includes ffmpeg).
6. Add security headers for the two apps at the web server, for example:
   `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob: https://*.tile.openstreetmap.org; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'`,
   plus `X-Content-Type-Options: nosniff` and `Referrer-Policy: same-origin`.
7. Create MDRRMO accounts with the CLI; never reuse the DEMO accounts, and do
   not run `seed-demo` or `seed-demo-history` (they are refused in production).
8. Back up the database and media volume, and restrict database access to the
   API host.

## Remaining risks and limits

- Rate-limit counters are kept in each API process's memory. They reset on
  restart, and each worker counts separately. A deployment with several
  servers would move them to a shared store such as Redis.
- Mobile carriers in the Philippines often share one IP address among many
  subscribers, so per-IP limits are kept generous; the per-account limits
  remain the main protection.
- Evidence files are not scanned for malware. Photos are re-encoded and videos
  are only remuxed, never played on the server.
- There is no two-factor sign-in for MDRRMO staff yet. It is recommended
  before real use.
- The audit log records access but nothing alerts on unusual activity.
- A formal penetration test and a Data Privacy Act (RA 10173) privacy impact
  assessment by the municipality are recommended before real residents use
  the system.
