import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AuthProvider } from '@beacon/auth';
import {
  ApiClient,
  type IncidentAnalysis,
  type PatternAnalysis,
  type MapData,
  type MapPoint,
  type SessionResponse,
  type StaffReportDetail,
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

export type Handler = (path: string, init?: RequestInit) => Response | Promise<Response>;

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
    source: 'resident',
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

export function makeDetail(overrides: Partial<StaffReportDetail> = {}): StaffReportDetail {
  return {
    ...makeRow(),
    description: 'Knee-deep water on the highway near the public market.',
    municipality: 'Dalaguete',
    province: 'Cebu',
    landmark: 'Public market',
    latitude: '9.761200',
    longitude: '123.534900',
    location_accuracy_m: 12,
    location_source: 'gps',
    external_ref: null,
    import_filename: null,
    reporter: {
      id: 'u2',
      full_name: 'Maria Santos',
      email: null,
      phone: '+639185550101',
      barangay: { id: 28, name: 'Poblacion' },
    },
    timeline: [
      {
        status: 'submitted',
        changed_at: '2026-09-30T06:20:00Z',
        by_role: 'resident',
        actor_name: 'Maria Santos',
        note: null,
      },
    ],
    media: [],
    verified_at: null,
    verified_by: null,
    verification_notes: null,
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    allowed_actions: ['under_verification', 'needs_clarification'],
    ...overrides,
  };
}

export function makePoint(overrides: Partial<MapPoint> = {}): MapPoint {
  return {
    reference_no: 'BEA-2026-000125',
    latitude: '9.761200',
    longitude: '123.534900',
    location_accuracy_m: 12,
    hazard_type: { id: 1, code: 'flood', name: 'Flood' },
    other_hazard_text: null,
    barangay: { id: 28, name: 'Poblacion' },
    landmark: 'Public market',
    incident_date: '2026-09-30',
    incident_time: '14:05:00',
    status: 'needs_clarification',
    is_demo: false,
    source: 'resident',
    ...overrides,
  };
}

export const MAP_DATA: MapData = {
  points: [
    makePoint(),
    makePoint({
      reference_no: 'BEA-2026-000123',
      latitude: '9.841200',
      longitude: '123.487300',
      hazard_type: { id: 2, code: 'landslide', name: 'Landslide' },
      barangay: { id: 23, name: 'Mantalongon' },
      landmark: null,
      status: 'under_verification',
      is_demo: true,
    }),
  ],
  without_location: 1,
  truncated: false,
};

export const HAZARD_TYPES = [
  { id: 1, code: 'flood', name: 'Flood' },
  { id: 2, code: 'landslide', name: 'Landslide' },
];
export const BARANGAYS = [
  { id: 23, name: 'Mantalongon' },
  { id: 28, name: 'Poblacion' },
];

export function makeAnalysis(overrides: Partial<IncidentAnalysis> = {}): IncidentAnalysis {
  const months = ['2025-09', '2025-10', '2025-11'];
  return {
    filters: {
      scope: 'confirmed',
      statuses: ['verified', 'resolved'],
      hazard: null,
      barangay_id: null,
      source: null,
      date_from: null,
      date_to: null,
      include_demo: true,
    },
    dataset: {
      total: 5,
      from_app: 1,
      imported: 4,
      demo: 4,
      with_coordinates: 3,
      with_time: 4,
      first_incident: '2025-09-03',
      last_incident: '2025-11-20',
    },
    by_hazard: [
      { code: 'landslide', name: 'Landslide', count: 3, share: 0.6 },
      { code: 'flood', name: 'Flood', count: 2, share: 0.4 },
    ],
    by_barangay: [
      {
        id: 23,
        name: 'Mantalongon',
        count: 3,
        share: 0.6,
        top_hazard: 'landslide',
        top_hazard_count: 3,
      },
      { id: 28, name: 'Poblacion', count: 2, share: 0.4, top_hazard: 'flood', top_hazard_count: 2 },
    ],
    without_barangay: 0,
    by_month: months.map((month, i) => ({ month, count: [2, 0, 3][i]! })),
    by_month_of_year: Array.from({ length: 12 }, (_, i) => ({
      key: i + 1,
      count: i === 8 ? 2 : i === 10 ? 3 : 0,
    })),
    by_hour: Array.from({ length: 24 }, (_, h) => ({ key: h, count: h === 16 ? 4 : 0 })),
    unknown_time: 1,
    by_weekday: Array.from({ length: 7 }, (_, d) => ({ key: d + 1, count: d === 2 ? 5 : 0 })),
    hazard_by_barangay: [
      { hazard: 'landslide', barangay_id: 23, count: 3 },
      { hazard: 'flood', barangay_id: 28, count: 2 },
    ],
    hazard_by_month_of_year: [],
    generated_at: '2026-09-30T06:00:00Z',
    ...overrides,
  };
}

const LANDSLIDE = { code: 'landslide', name: 'Landslide' };
const TYPHOON = { code: 'typhoon', name: 'Typhoon' };

export function makePatterns(overrides: Partial<PatternAnalysis> = {}): PatternAnalysis {
  return {
    filters: makeAnalysis().filters,
    parameters: {
      hotspot_distance_m: 500,
      hotspot_min_records: 3,
      recurrence_min_records: 3,
      co_occurrence_days: 2,
    },
    dataset: {
      total: 215,
      with_coordinates: 173,
      first_incident: '2024-10-06',
      last_incident: '2026-09-30',
      months_covered: 24,
      sufficient: true,
    },
    findings: [
      {
        kind: 'recurrence',
        hazard: 'landslide',
        text: 'Recurring landslide incidents were identified in the recorded dataset for Mantalongon: 10 records in 8 different months, from Nov 2024 to Sep 2026.',
      },
      {
        kind: 'trend',
        hazard: null,
        text: 'No clear upward or downward trend was found in the number of incidents recorded per month over the 24 months covered.',
      },
    ],
    recurring_locations: [
      {
        hazard: LANDSLIDE,
        barangay_id: 23,
        barangay: 'Mantalongon',
        count: 10,
        months_with_records: 8,
        years_with_records: 3,
        first: '2024-11-02',
        last: '2026-09-12',
        share_of_hazard: 0.1667,
      },
    ],
    hotspots: [
      {
        id: 'H1',
        hazard: LANDSLIDE,
        count: 3,
        center_latitude: 9.8412,
        center_longitude: 123.4873,
        radius_m: 485,
        barangays: ['Mantalongon'],
        first: '2024-11-02',
        last: '2026-09-12',
        reference_nos: ['IMP-2024-000003', 'IMP-2025-000010', 'IMP-2026-000040'],
      },
    ],
    seasonality: [
      {
        hazard: LANDSLIDE,
        total: 60,
        monthly: [1, 0, 1, 0, 1, 4, 5, 6, 14, 8, 15, 5],
        peak_months: [9, 11],
        p_value: 0.000001,
        concentrated: true,
      },
      {
        hazard: TYPHOON,
        total: 5,
        monthly: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0],
        peak_months: [],
        p_value: null,
        concentrated: false,
      },
    ],
    trend_months: ['2026-06', '2026-07', '2026-08', '2026-09'],
    trends: [
      {
        hazard: null,
        total: 215,
        months: 24,
        change_per_year: 1.55,
        tau: 0.08,
        p_value: 0.6,
        direction: 'no_clear_trend',
        counts: [12, 30, 25, 20],
        fit_start: 20,
        fit_end: 24,
      },
      {
        hazard: LANDSLIDE,
        total: 60,
        months: 24,
        change_per_year: 3,
        tau: 0.4,
        p_value: 0.01,
        direction: 'increasing',
        counts: [2, 5, 9, 14],
        fit_start: 1.5,
        fit_end: 13,
      },
    ],
    co_occurrence: [{ hazard: TYPHOON, with_hazard: LANDSLIDE, count: 4, share: 0.8, lift: 2.1 }],
    generated_at: '2026-09-30T06:00:00Z',
    ...overrides,
  };
}

type Override = (init?: RequestInit) => Response | Promise<Response>;

export function signedInWith(overrides: Record<string, Override> = {}): Handler {
  return (path, init) => {
    const override = overrides[path];
    if (override) return override(init);
    if (path === '/staff/auth/refresh') return json(200, session());
    if (path === '/staff/auth/logout') return new Response(null, { status: 204 });
    if (path === '/staff/dashboard?include_demo=true') return json(200, makeDashboard());
    if (path === '/staff/dashboard?include_demo=false')
      return json(200, makeDashboard(undefined, false));
    if (path === '/hazard-types') return json(200, HAZARD_TYPES);
    if (path.startsWith('/staff/map/reports?')) return json(200, MAP_DATA);
    if (path === '/barangays') return json(200, BARANGAYS);
    if (path.startsWith('/staff/reports?')) {
      const items = [makeRow(), DEMO_ROW];
      return json(200, { items, total: items.length, limit: 20, offset: 0 });
    }
    if (path === '/staff/reports/BEA-2026-000125') return json(200, makeDetail());
    if (path.startsWith('/staff/analysis/incidents?')) return json(200, makeAnalysis());
    if (path.startsWith('/staff/analysis/patterns?')) return json(200, makePatterns());
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
