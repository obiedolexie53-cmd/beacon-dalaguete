import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, makeDetail, renderApp, signedInWith } from '../../test/renderApp';

afterEach(cleanup);

describe('report details', () => {
  it('shows the status history with MDRRMO notes, details and location', async () => {
    renderApp('/my-reports/BEA-2026-000123', signedInWith());
    expect(await screen.findByRole('heading', { level: 1, name: 'Landslide' })).toBeTruthy();
    expect(screen.getAllByText('Under Verification').length).toBeGreaterThan(0);
    const history = screen.getByRole('heading', { name: 'Status history' }).parentElement!;
    expect(within(history).getByText('Submitted')).toBeTruthy();
    expect(within(history).getByText(/You$/)).toBeTruthy();
    expect(
      within(history).getByText('“DEMO: Forwarded to field team for validation.”'),
    ).toBeTruthy();
    expect(screen.getByText('9.841200, 123.487300')).toBeTruthy();
    expect(screen.getByLabelText('Map showing the incident location')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Place pin at map centre' })).toBeNull();
    expect(screen.getByText('DEMO DATA')).toBeTruthy();
  });

  it('highlights a request for clarification', async () => {
    renderApp(
      '/my-reports/BEA-2026-000123',
      signedInWith({
        '/me/reports/BEA-2026-000123': () =>
          json(
            200,
            makeDetail({
              status: 'needs_clarification',
              timeline: [
                { status: 'submitted', changed_at: '2026-09-28T08:52:00Z', by: 'you', note: null },
                {
                  status: 'needs_clarification',
                  changed_at: '2026-09-28T09:52:00Z',
                  by: 'mdrrmo',
                  note: 'Which sitio is affected?',
                },
              ],
            }),
          ),
      }),
    );
    expect(await screen.findByText('The MDRRMO needs more information')).toBeTruthy();
    expect(screen.getAllByText('“Which sitio is affected?”').length).toBe(2);
  });

  it('shows photos and videos through their signed links', async () => {
    renderApp(
      '/my-reports/BEA-2026-000123',
      signedInWith({
        '/me/reports/BEA-2026-000123': () =>
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
                  uploaded_at: '2026-09-28T09:00:00Z',
                  url: '/api/v1/media/m1?exp=1&sig=abc',
                },
              ],
            }),
          ),
      }),
    );
    const img = await screen.findByAltText('Photo 1 for BEA-2026-000123');
    expect(img.getAttribute('src')).toBe('/api/v1/media/m1?exp=1&sig=abc');
  });

  it('shows "Report not found" for reports that are not the resident’s', async () => {
    renderApp(
      '/my-reports/BEA-2026-999999',
      signedInWith({
        '/me/reports/BEA-2026-999999': () =>
          json(404, { error: { code: 'not_found', message: 'Report not found.' } }),
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Report not found' })).toBeTruthy();
  });

  it('opens from a report card in My Reports', async () => {
    const { router } = renderApp('/my-reports', signedInWith());
    await userEvent.click(await screen.findByRole('link', { name: 'View report BEA-2026-000123' }));
    expect(router.state.location.pathname).toBe('/my-reports/BEA-2026-000123');
  });
});

describe('notifications', () => {
  it('shows the unread count on the navigation', async () => {
    renderApp('/home', signedInWith());
    expect(await screen.findByRole('link', { name: 'Notifications, 1 unread' })).toBeTruthy();
  });

  it('lists notifications and opens the related report', async () => {
    const { router, calls } = renderApp('/notifications', signedInWith());
    const unread = await screen.findByRole('button', {
      name: /^Unread\. Your report is being verified\./,
    });
    await userEvent.click(unread);
    await waitFor(() => expect(router.state.location.pathname).toBe('/my-reports/BEA-2026-000123'));
    expect(calls.some((c) => c.path === '/me/notifications/n2/read')).toBe(true);
  });

  it('marks everything as read', async () => {
    const { calls } = renderApp('/notifications', signedInWith());
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));
    await waitFor(() =>
      expect(calls.some((c) => c.path === '/me/notifications/read-all')).toBe(true),
    );
  });
});
