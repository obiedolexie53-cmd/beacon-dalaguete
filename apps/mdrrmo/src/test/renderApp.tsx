import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AuthProvider } from '@beacon/auth';
import {
  ApiClient,
  type SessionResponse,
  type StaffDashboard,
  type StaffReportRow,
  type UserProfile,
} from '@beacon/shared';
import { routes } from '../app/routes';

export const OFFICER: UserProfile = {
  id: 's1',
  full_name: 'Juan Dela Cruz',
  email: 'officer@example.gov.ph',
  phone: null,
  role: 'mdrrmo',
  barangay: null,
  is_demo: false,
};

export const session = (user: UserProfile = OFFICER): SessionResponse => ({
  access_token: 'tok',
  token_type: 'bearer',
  expires_in: 900,
  user,
});

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

export type Handler = (path: string) => Response | Promise<Response>;

export const anonymous: Handler = (path) =>
  path === '/staff/auth/refresh'
    ? json(401, { error: { code: 'session_expired', message: 'ended' } })
    : json(404, {});

export function makeRow(overrides: Partial<StaffReportRow> = {}): StaffReportRow {
  return {
    id: 'r1',
    reference_no: 'BEA-2026-000125',
    hazard_type: { id: 1, code: 'flood', name: 'Flood' },
    other_hazard_text: null,
    barangay: { id: 28, name: 'Poblacion' },
    incident_date: '2026-09-30',
    incident_time: '14:05:00',
    submitted_at: '2026-09-30T06:20:00Z',
    status: 'submitted',
    is_demo: false,
    ...overrides,
  };
}

export const DEMO_ROW = makeRow({
  id: 'demo',
  reference_no: 'BEA-2026-000123',
  hazard_type: { id: 2, code: 'landslide', name: 'Landslide' },
  barangay: { id: 23, name: 'Mantalongon' },
  incident_date: '2026-09-28',
  incident_time: '16:35:00',
  submitted_at: '2026-09-28T08:52:00Z',
  status: 'under_verification',
  is_demo: true,
});

export function makeDashboard(rows = [makeRow(), DEMO_ROW], includeDemo = true): StaffDashboard {
  const visible = includeDemo ? rows : rows.filter((r) => !r.is_demo);
  const count = (status: StaffReportRow['status']) =>
    visible.filter((r) => r.status === status).length;
  return {
    counts: {
      total: visible.length,
      new: count('submitted'),
      under_verification: count('under_verification'),
      needs_clarification: count('needs_clarification'),
      verified: count('verified'),
      resolved: count('resolved'),
    },
    recent_reports: visible,
    include_demo: includeDemo,
    generated_at: '2026-09-30T14:00:00Z',
  };
}

export function signedInWith(
  overrides: Record<string, () => Response | Promise<Response>> = {},
): Handler {
  return (path) => {
    const override = overrides[path];
    if (override) return override();
    if (path === '/staff/auth/refresh') return json(200, session());
    if (path === '/staff/auth/logout') return new Response(null, { status: 204 });
    if (path === '/staff/dashboard?include_demo=true') return json(200, makeDashboard());
    if (path === '/staff/dashboard?include_demo=false')
      return json(200, makeDashboard(undefined, false));
    return json(404, {});
  };
}

export const signedIn: Handler = signedInWith();

export function renderApp(path: string, handler: Handler) {
  const calls: Array<{ path: string; body: unknown }> = [];
  const client = new ApiClient({
    baseUrl: '/api/v1',
    authPath: '/staff/auth',
    fetch: (async (url: string, init: RequestInit) => {
      const apiPath = url.replace('/api/v1', '');
      calls.push({ path: apiPath, body: init.body ? JSON.parse(String(init.body)) : undefined });
      return handler(apiPath);
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
