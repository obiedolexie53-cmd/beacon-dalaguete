# BEACON Design System

All UI comes from `packages/ui`. Apps import `@beacon/ui/styles.css` once and use
the React components from `@beacon/ui`. Never hard-code colours in app code.
Use the `--bcn-*` CSS variables, or `colors` from `@beacon/ui` for charts and maps.

## Colour

| Role                    | Token               | Value     | Notes                                      |
| ----------------------- | ------------------- | --------- | ------------------------------------------ |
| Primary (Deep Navy)     | `--bcn-navy-900`    | `#0b2545` | Headings, primary buttons, app bars        |
| Secondary (Beacon Blue) | `--bcn-blue-600`    | `#1a62c0` | Links, info states, focus ring             |
| Accent (Golden Amber)   | `--bcn-amber-500`   | `#f2a900` | Report action. **Always navy text on it.** |
| Success                 | `--bcn-success-600` | `#1a7431` | Verified                                   |
| Warning (Orange)        | `--bcn-warning-600` | `#a34c00` | Safety notices, Needs Clarification        |
| Danger                  | `--bcn-danger-600`  | `#c62828` | Errors, failed submission                  |
| Background              | `--bcn-bg`          | `#f3f6fa` | Page background                            |
| Cards                   | `--bcn-surface`     | `#ffffff` |                                            |
| Text                    | `--bcn-text`        | `#172033` |                                            |

Every text/background pair used by the components meets **WCAG 2.1 AA** (≥ 4.5:1).
Success and warning were darkened from their first values to pass. The focus
ring (white gap + blue ring) meets the 3:1 non-text contrast requirement on
both light and navy surfaces.

## Report status badges

Each status has a colour **and** an icon, so it is never conveyed by colour alone.

| Status                                 | Tone    | Icon         |
| -------------------------------------- | ------- | ------------ |
| Submitted                              | neutral | send         |
| Under Verification                     | blue    | search       |
| For Verification / Needs Clarification | orange  | help circle  |
| Verified                               | green   | shield check |
| Resolved                               | navy    | check circle |

## Map marker colours (status)

| Status                                 | Marker    | Icon on marker |
| -------------------------------------- | --------- | -------------- |
| Submitted                              | `#b8860b` | send           |
| Under Verification                     | `#2563eb` | search         |
| For Verification / Needs Clarification | `#d23a2a` | help circle    |
| Verified                               | `#15924a` | shield check   |
| Resolved                               | `#6b7280` | check circle   |

These are `statusMarkerColors` in `@beacon/ui`. They were validated with the
dataviz palette validator: all pairs are distinct for normal colour vision.
Resolved is a deliberate neutral grey, so finished reports recede. Because no
five-colour set keeps every pair apart for colour-blind viewers, markers always
carry the status icon, and the legend and marker labels give the status in words.

## Accessibility rules

- Touch targets are at least **48 × 48 px** (`--bcn-touch-target`).
- Body and input text is at least **16 px**, which also prevents iOS zoom on focus.
- Form fields link label, hint and error via `aria-describedby`. Invalid fields set `aria-invalid`.
- Danger alerts use `role="alert"`. Others (including static safety notices) use the
  polite `role="status"`, so they are not read out urgently on every page load.
- `prefers-reduced-motion` disables animations.
- Buttons default to `type="button"` so they never submit forms by accident.

## Components

`Button` · `Card` · `Badge` · `DemoBadge` · `StatusBadge` · `HazardIcon` · `Alert` ·
`EmptyState` · `TextField` · `TextAreaField` · `SelectField` · `PageHeader` ·
`Spinner` · `OfflineBanner` / `useOnlineStatus` · `Logo` / `LogoMark`

Icons come from [Lucide](https://lucide.dev) (ISC licence): simple line icons with
no brand or game styling.

## Demo data

Anything fictional (Leona Legaspi, `BEA-2026-000123`) is shown with `<DemoBadge />`
("DEMO DATA") and lives only in each app's `src/demo/` folder, which is removed
from screens as real data is connected.

## Navigation

- **Resident (mobile):** Splash → Welcome → Login / Registration → bottom navigation:
  Home · **Report** (amber) · My Reports · Notifications · Profile.
- **MDRRMO (desktop):** sidebar with Dashboard · Reports · Disaster Map ·
  Historical Reports · Pattern Analysis. Below 900 px it becomes a slide-in menu.

## PWA

The resident app is installable (web manifest + service worker via `vite-plugin-pwa`).
The service worker caches **only the app shell** (code, styles, fonts, icons).
API responses contain personal and report data and are never cached.
Regenerate icons from `apps/resident/public/icons/beacon.svg` with
`pnpm --filter @beacon/resident icons`.
