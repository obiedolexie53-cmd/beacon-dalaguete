import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AuthProvider } from '@beacon/auth';
import {
  ApiClient,
  type NotificationList,
  type ReportDetail,
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

export const BARANGAYS = [
  { id: 1, name: 'Ablayan' },
  { id: 23, name: 'Mantalongon' },
  { id: 28, name: 'Poblacion' },
];

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

export function makeDetail(overrides: Partial<ReportDetail> = {}): ReportDetail {
  return {
    ...DEMO_REPORT,
    description: 'DEMO DATA: Soil and rocks slid onto the barangay road.',
    municipality: 'Dalaguete',
    province: 'Cebu',
    landmark: 'Near the barangay hall road junction',
    latitude: '9.841200',
    longitude: '123.487300',
    location_accuracy_m: 12,
    location_source: 'gps',
    timeline: [
      { status: 'submitted', changed_at: '2026-09-28T08:52:00Z', by: 'you', note: null },
      {
        status: 'under_verification',
        changed_at: '2026-09-28T09:52:00Z',
        by: 'mdrrmo',
        note: 'DEMO: Forwarded to field team for validation.',
      },
    ],
    media: [],
    evidence_open: true,
    ...overrides,
  };
}

export const NOTIFICATIONS: NotificationList = {
  unread: 1,
  items: [
    {
      id: 'n2',
      kind: 'status_under_verification',
      title: 'Your report is being verified',
      body: 'MDRRMO personnel are now reviewing report BEA-2026-000123.',
      report_reference_no: 'BEA-2026-000123',
      read: false,
      created_at: '2026-09-28T09:52:00Z',
    },
    {
      id: 'n1',
      kind: 'report_submitted',
      title: 'Report received',
      body: 'Report BEA-2026-000123 was submitted.',
      report_reference_no: 'BEA-2026-000123',
      read: true,
      created_at: '2026-09-28T08:52:00Z',
    },
  ],
};

type Override = (init: RequestInit) => Response | Promise<Response>;

/** A signed-in resident, with optional overrides for specific API paths. */
export function signedInWith(overrides: Record<string, Override> = {}): Handler {
  return (path, init) => {
    const override = overrides[path];
    if (override) return override(init);
    if (path === '/auth/refresh') return json(200, session());
    if (path === '/auth/logout') return new Response(null, { status: 204 });
    if (path === '/me/dashboard') return json(200, makeDashboard());
    if (path === '/hazard-types') return json(200, HAZARD_TYPES);
    if (path === '/barangays') return json(200, BARANGAYS);
    if (path === '/me/notifications') return json(200, NOTIFICATIONS);
    if (path === '/me/notifications/unread-count')
      return json(200, { unread: NOTIFICATIONS.unread });
    if (path.startsWith('/me/notifications/')) return new Response(null, { status: 204 });
    if (path.startsWith('/me/reports?')) {
      const items = [makeReport(), DEMO_REPORT];
      return json(200, { items, total: items.length });
    }
    if (path === '/me/reports/BEA-2026-000123') return json(200, makeDetail());
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
      const body =
        init.body instanceof FormData
          ? init.body
          : init.body
            ? JSON.parse(String(init.body))
            : undefined;
      calls.push({ path: apiPath, body });
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
