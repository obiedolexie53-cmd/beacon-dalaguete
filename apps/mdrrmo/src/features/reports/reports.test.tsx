import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEMO_ROW, json, makeDetail, makeRow, renderApp, signedInWith } from '../../test/renderApp';

afterEach(cleanup);

const lastListCall = (calls: Array<{ path: string }>) =>
  [...calls].reverse().find((c) => c.path.startsWith('/staff/reports?'))!.path;

describe('reports list', () => {
  it('lists reports with a count', async () => {
    renderApp('/reports', signedInWith());
    expect(await screen.findByText('Showing 1–2 of 2 reports')).toBeTruthy();
    expect(screen.getByText('BEA-2026-000125')).toBeTruthy();
    expect(screen.getByText(DEMO_ROW.reference_no)).toBeTruthy();
  });

  it('filters by status and hazard through the URL', async () => {
    const { router, calls } = renderApp('/reports', signedInWith());
    await screen.findByText('BEA-2026-000125');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Verified');
    await userEvent.selectOptions(await screen.findByLabelText('Hazard'), 'Landslide');
    await waitFor(() =>
      expect(router.state.location.search).toBe('?status=verified&hazard=landslide'),
    );
    await waitFor(() => expect(lastListCall(calls)).toContain('status=verified'));
    expect(lastListCall(calls)).toContain('hazard=landslide');
    expect(lastListCall(calls)).toContain('offset=0');
  });

  it('searches and clears filters', async () => {
    const { router, calls } = renderApp('/reports', signedInWith());
    await userEvent.type(await screen.findByLabelText('Search'), 'market');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastListCall(calls)).toContain('q=market'));
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('can leave out demo records', async () => {
    const { calls } = renderApp('/reports', signedInWith());
    await screen.findByText('BEA-2026-000125');
    await userEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(lastListCall(calls)).toContain('include_demo=false'));
  });

  it('pages through results', async () => {
    const { router, calls } = renderApp(
      '/reports',
      signedInWith({
        '/staff/reports?include_demo=true&limit=20&offset=0': () =>
          json(200, { items: [makeRow()], total: 45, limit: 20, offset: 0 }),
      }),
    );
    expect(await screen.findByText('Page 1 of 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous' })).toHaveProperty('disabled', true);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));
    await waitFor(() => expect(lastListCall(calls)).toContain('offset=20'));
  });

  it('explains when nothing matches', async () => {
    renderApp(
      '/reports?status=resolved',
      signedInWith({
        '/staff/reports?status=resolved&include_demo=true&limit=20&offset=0': () =>
          json(200, { items: [], total: 0, limit: 20, offset: 0 }),
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'No reports match these filters' }),
    ).toBeTruthy();
  });

  it('is reached from a dashboard tile', async () => {
    const { router } = renderApp('/dashboard', signedInWith());
    await userEvent.click(await screen.findByRole('link', { name: /^New reports: 1/ }));
    expect(router.state.location.pathname).toBe('/reports');
    expect(router.state.location.search).toBe('?status=submitted');
  });
});

describe('report review', () => {
  const REF = 'BEA-2026-000125';
  const path = `/staff/reports/${REF}`;

  it('shows the reporter, incident, location and history', async () => {
    renderApp(`/reports/${REF}`, signedInWith());
    const reporter = (await screen.findByRole('heading', { name: 'Reporter' })).parentElement!;
    expect(within(reporter).getByText('Maria Santos')).toBeTruthy();
    expect(
      within(reporter).getByRole('link', { name: '+63 918 555 0101' }).getAttribute('href'),
    ).toBe('tel:+639185550101');
    expect(within(reporter).getByText(/Your access is recorded/)).toBeTruthy();
    expect(screen.getByText('Knee-deep water on the highway near the public market.')).toBeTruthy();
    expect(screen.getByText(/accurate to about 12 m/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /Map of the incident location/ })).toBeTruthy();
    expect(screen.getByText(/Maria Santos \(reporter\)/)).toBeTruthy();
  });

  it('offers only the allowed next steps', async () => {
    renderApp(`/reports/${REF}`, signedInWith());
    expect(await screen.findByRole('button', { name: 'Mark as Under Verification' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request Clarification' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verify Report' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as Resolved' })).toBeNull();
  });

  it('updates the status and shows the result', async () => {
    const { calls } = renderApp(
      `/reports/${REF}`,
      signedInWith({
        [`${path}/status`]: () =>
          json(
            200,
            makeDetail({
              status: 'under_verification',
              allowed_actions: ['needs_clarification', 'verified'],
            }),
          ),
      }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as Under Verification' }),
    );
    await userEvent.type(screen.getByLabelText('Note (optional)'), 'Sent a team');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Status updated to Under Verification')).toBeTruthy();
    expect(calls.find((c) => c.path === `${path}/status`)?.body).toEqual({
      status: 'under_verification',
      from_status: 'submitted',
      note: 'Sent a team',
    });
    expect(screen.getByRole('button', { name: 'Verify Report' })).toBeTruthy();
  });

  it('reminds officers what verification means', async () => {
    renderApp(
      `/reports/${REF}`,
      signedInWith({
        [path]: () =>
          json(
            200,
            makeDetail({
              status: 'under_verification',
              allowed_actions: ['needs_clarification', 'verified'],
            }),
          ),
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Verify Report' }));
    expect(screen.getByText(/do not prove a report is genuine on their own/)).toBeTruthy();
  });

  it('requires a note when asking for clarification', async () => {
    const { calls } = renderApp(`/reports/${REF}`, signedInWith());
    await userEvent.click(await screen.findByRole('button', { name: 'Request Clarification' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByText('Tell the reporter what information is needed')).toBeTruthy();
    expect(calls.some((c) => c.path === `${path}/status`)).toBe(false);
  });

  it('explains when someone else changed the report first', async () => {
    renderApp(
      `/reports/${REF}`,
      signedInWith({
        [`${path}/status`]: () =>
          json(409, {
            error: {
              code: 'status_changed',
              message: 'This report was updated by someone else and is now Under Verification.',
            },
          }),
      }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as Under Verification' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Status not updated')).toBeTruthy();
    expect(screen.getByText(/updated by someone else/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload report' })).toBeTruthy();
  });

  it('has no actions once resolved', async () => {
    renderApp(
      `/reports/${REF}`,
      signedInWith({
        [path]: () => json(200, makeDetail({ status: 'resolved', allowed_actions: [] })),
      }),
    );
    expect(await screen.findByText(/No further status changes are possible/)).toBeTruthy();
  });

  it('shows evidence with a reminder that it is supporting only', async () => {
    renderApp(
      `/reports/${REF}`,
      signedInWith({
        [path]: () =>
          json(
            200,
            makeDetail({
              media: [
                {
                  id: 'm1',
                  kind: 'photo',
                  mime_type: 'image/jpeg',
                  size_bytes: 1000,
                  width: 800,
                  height: 600,
                  uploaded_at: '2026-09-30T06:21:00Z',
                  url: '/api/v1/media/m1?exp=1&sig=x',
                },
              ],
            }),
          ),
      }),
    );
    expect(await screen.findByAltText(`Photo 1 for ${REF}`)).toBeTruthy();
    expect(screen.getByText(/does not prove on its own that the incident is genuine/)).toBeTruthy();
  });

  it('shows the source of imported MDRRMO records instead of a reporter', async () => {
    renderApp(
      `/reports/${REF}`,
      signedInWith({
        [path]: () =>
          json(
            200,
            makeDetail({
              source: 'import',
              reporter: null,
              external_ref: 'MDRRMO-2025-0142',
              import_filename: 'records-2025.csv',
              location_source: null,
              status: 'verified',
              allowed_actions: ['resolved'],
              timeline: [
                {
                  status: 'verified',
                  changed_at: '2026-09-30T06:20:00Z',
                  by_role: 'mdrrmo',
                  actor_name: 'Juan Dela Cruz',
                  note: 'Imported from MDRRMO records (records-2025.csv).',
                },
              ],
            }),
          ),
      }),
    );
    const source = (await screen.findByRole('heading', { name: 'Source' })).parentElement!;
    expect(within(source).getByText('Imported')).toBeTruthy();
    expect(within(source).getByText('MDRRMO-2025-0142')).toBeTruthy();
    expect(within(source).getByText('records-2025.csv')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Reporter' })).toBeNull();
    expect(screen.getByText('From the MDRRMO record')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Mark as Resolved' }));
    expect(screen.getByText(/imported record, no reporter/)).toBeTruthy();
  });

  it('shows "Report not found" for unknown references', async () => {
    renderApp(
      '/reports/BEA-2026-999999',
      signedInWith({
        '/staff/reports/BEA-2026-999999': () =>
          json(404, { error: { code: 'not_found', message: 'Report not found.' } }),
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Report not found' })).toBeTruthy();
  });
});
