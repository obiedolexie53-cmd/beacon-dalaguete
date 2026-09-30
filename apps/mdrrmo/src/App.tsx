import { MUNICIPALITY, PROVINCE, REPORT_STATUSES, REPORT_STATUS_LABELS } from '@beacon/shared';
import { useApiStatus } from './useApiStatus';

const API_STATUS_TEXT = {
  checking: 'Checking connection…',
  online: 'Connected to BEACON server',
  offline: 'Server not reachable.',
} as const;

/**
 * Phase 1 placeholder screen. Replaced by the staff login, monitoring
 * dashboard, verification, map and analysis modules in Phases 9–14.
 */
export function App() {
  const apiStatus = useApiStatus();

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 32 }}>
      <h1 style={{ color: 'var(--beacon-color-primary)', marginBottom: 4 }}>
        BEACON MDRRMO Console
      </h1>
      <p style={{ marginTop: 0, color: 'var(--beacon-color-text-muted)' }}>
        {MUNICIPALITY}, {PROVINCE} · Authorized MDRRMO personnel only
      </p>

      <p role="status">{API_STATUS_TEXT[apiStatus]}</p>

      <section aria-labelledby="workflow-heading">
        <h2 id="workflow-heading">Report status workflow</h2>
        <ol>
          {REPORT_STATUSES.map((status) => (
            <li key={status}>{REPORT_STATUS_LABELS[status]}</li>
          ))}
        </ol>
      </section>

      <p style={{ fontSize: 14, color: 'var(--beacon-color-text-muted)' }}>
        Research prototype: project scaffold (Phase 1).
      </p>
    </main>
  );
}
