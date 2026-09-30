import { DEFAULT_HAZARD_TYPES, MUNICIPALITY, PROVINCE } from '@beacon/shared';
import { useApiStatus } from './useApiStatus';

const API_STATUS_TEXT = {
  checking: 'Checking connection…',
  online: 'Connected to BEACON server',
  offline: 'Server not reachable. Please check your connection and try again.',
} as const;

/**
 * Phase 1 placeholder screen. Replaced by the splash → welcome → login flow
 * and bottom navigation (Home, Report, My Reports, Notifications, Profile) in
 * Phases 2–4.
 */
export function App() {
  const apiStatus = useApiStatus();

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <h1 style={{ color: 'var(--beacon-color-primary)', marginBottom: 4 }}>BEACON</h1>
      <p style={{ marginTop: 0, color: 'var(--beacon-color-text-muted)' }}>
        Community disaster reporting · {MUNICIPALITY}, {PROVINCE}
      </p>

      <p role="status">{API_STATUS_TEXT[apiStatus]}</p>

      <section aria-labelledby="hazards-heading">
        <h2 id="hazards-heading">Hazard types</h2>
        <ul>
          {DEFAULT_HAZARD_TYPES.map((hazard) => (
            <li key={hazard.code}>{hazard.name}</li>
          ))}
        </ul>
      </section>

      <p style={{ fontSize: 14, color: 'var(--beacon-color-text-muted)' }}>
        Research prototype: project scaffold (Phase 1).
      </p>
    </main>
  );
}
