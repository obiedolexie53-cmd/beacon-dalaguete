import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AuthProvider } from '@beacon/auth';
import {
  ApiClient,
  type ReportSummary,
  type ResidentDashboard,
  type SessionResponse,
  type StatusCounts,
  type UserProfile,
} from '@beacon/shared';
import { routes } from '../app/routes';

export const RESIDENT: UserProfile = {
  id: 'u1',
  full_name: 'Leona Legaspi',
  email: 'leona@example.com',
  phone: '+639171234567',
  role: 'resident',
  barangay: { id: 23, name: 'Mantalongon' },
  is_demo: false,
};

export const session = (user: UserProfile = RESIDENT): SessionResponse => ({
  access_token: 'tok',
  token_type: 'bearer',
  expires_in: 900,
  user,
});

export const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status });

export type Handler = (path: string, init: RequestInit) => Response | Promise<Response>;

/** A handler for a visitor with no saved session. */
export const anonymous: Handler = (path) =>
  path === '/auth/refresh'
    ? json(401, { error: { code: 'session_expired', message: 'ended' } })
    : json(404, {});

export const HAZARD_TYPES = [
  { id: 1, code: 'flood', name: 'Flood' },
  { id: 2, code: 'landslide', name: 'Landslide' },
  { id: 3, code: 'earthquake', name: 'Earthquake' },
  { id: 9, code: 'other', name: 'Other Hazard' },
];

export function makeReport(overrides: Partial<ReportSummary> = {}): ReportSummary {
  return {
    id: 'r1',
    reference_no: 'BEA-2026-000124',
    hazard_type: { id: 1, code: 'flood', name: 'Flood' },
    other_hazard_text: null,
    barangay: { id: 23, name: 'Mantalongon' },
    incident_date: '2026-09-29',
    incident_time: '08:15:00',
    status: 'submitted',
    submitted_at: '2026-09-29T00:30:00Z',
    is_demo: false,
    ...overrides,
  };
}

export const DEMO_REPORT = makeReport({
  id: 'demo',
  reference_no: 'BEA-2026-000123',
  hazard_type: { id: 2, code: 'landslide', name: 'Landslide' },
  incident_date: '2026-09-28',
  incident_time: '16:35:00',
  status: 'under_verification',
  is_demo: true,
});

export function makeDashboard(
  reports: ReportSummary[] = [makeReport(), DEMO_REPORT],
  counts: Partial<StatusCounts> = {},
): ResidentDashboard {
  const base: StatusCounts = {
    total: reports.length,
    submitted: 0,
    under_verification: 0,
    needs_clarification: 0,
    verified: 0,
    resolved: 0,
  };
  for (const r of reports) base[r.status] += 1;
  return { counts: { ...base, ...counts }, recent_reports: reports.slice(0, 3) };
}

/** A signed-in resident, with optional overrides for specific API paths. */
export function signedInWith(overrides: Record<string, () => Response> = {}): Handler {
  return (path) => {
    const override = overrides[path];
    if (override) return override();
    if (path === '/auth/refresh') return json(200, session());
    if (path === '/auth/logout') return new Response(null, { status: 204 });
    if (path === '/me/dashboard') return json(200, makeDashboard());
    if (path === '/hazard-types') return json(200, HAZARD_TYPES);
    if (path.startsWith('/me/reports')) {
      const items = [makeReport(), DEMO_REPORT];
      return json(200, { items, total: items.length });
    }
    return json(404, {});
  };
}

/** A handler for a signed-in resident with two reports (one DEMO). */
export const signedIn: Handler = signedInWith();

/** Render the resident app at `path` against a fake API. */
export function renderApp(path: string, handler: Handler) {
  const calls: Array<{ path: string; body: unknown }> = [];
  const client = new ApiClient({
    baseUrl: '/api/v1',
    authPath: '/auth',
    fetch: (async (url: string, init: RequestInit) => {
      const apiPath = url.replace('/api/v1', '');
      calls.push({ path: apiPath, body: init.body ? JSON.parse(String(init.body)) : undefined });
      return handler(apiPath, init);
    }) as unknown as typeof fetch,
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AuthProvider client={client}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return { router, calls };
}
