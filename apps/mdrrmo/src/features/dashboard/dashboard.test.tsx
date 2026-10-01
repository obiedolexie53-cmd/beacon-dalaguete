import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, makeDashboard, makeRow, renderApp, signedInWith } from '../../test/renderApp';
import { DASHBOARD_REFRESH_MS } from './DashboardPage';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function tileValue(label: string) {
  const labelEl = screen.getByText(label, { selector: '.m-stat__label' });
  return labelEl.parentElement!.querySelector('.m-stat__value')!.textContent;
}

describe('monitoring dashboard', () => {
  it('shows live counts for every status', async () => {
    renderApp(
      '/dashboard',
      signedInWith({
        '/staff/dashboard?include_demo=true': () =>
          json(
            200,
            makeDashboard([
              makeRow({ id: 'a', status: 'submitted' }),
              makeRow({ id: 'b', status: 'submitted' }),
              makeRow({ id: 'c', status: 'under_verification' }),
              makeRow({ id: 'd', status: 'needs_clarification' }),
              makeRow({ id: 'e', status: 'verified' }),
              makeRow({ id: 'f', status: 'resolved' }),
            ]),
          ),
      }),
    );
    await screen.findAllByRole('row');
    expect(tileValue('Total reports')).toBe('6');
    expect(tileValue('New reports')).toBe('2');
    expect(tileValue('Under verification')).toBe('1');
    expect(tileValue('Needs clarification')).toBe('1');
    expect(tileValue('Verified')).toBe('1');
    expect(tileValue('Resolved')).toBe('1');
  });

  it('lists recent reports with the required columns and a review action', async () => {
    const { router } = renderApp('/dashboard', signedInWith());
    const table = await screen.findByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Report ID', 'Hazard', 'Barangay', 'Date/time', 'Status', 'Action']);
    const [, first, second] = within(table).getAllByRole('row');
    expect(within(first!).getByText('BEA-2026-000125')).toBeTruthy();
    expect(within(first!).getByText('Poblacion')).toBeTruthy();
    expect(within(first!).getByText(/September 30, 2026, 2:05 PM/)).toBeTruthy();
    expect(within(first!).getByText('Submitted', { selector: '.bcn-badge' })).toBeTruthy();
    expect(within(second!).getByText('DEMO')).toBeTruthy();

    await userEvent.click(
      within(first!).getByRole('link', { name: 'Review report BEA-2026-000125' }),
    );
    expect(router.state.location.pathname).toBe('/reports/BEA-2026-000125');
  });

  it('can leave out demo records', async () => {
    const { calls } = renderApp('/dashboard', signedInWith());
    await screen.findByText('BEA-2026-000123');
    await userEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.queryByText('BEA-2026-000123')).toBeNull());
    expect(tileValue('Total reports')).toBe('1');
    expect(calls.some((c) => c.path === '/staff/dashboard?include_demo=false')).toBe(true);
  });

  it('shows an empty state when there are no reports', async () => {
    renderApp(
      '/dashboard',
      signedInWith({ '/staff/dashboard?include_demo=true': () => json(200, makeDashboard([])) }),
    );
    expect(await screen.findByRole('heading', { name: 'No reports available' })).toBeTruthy();
    expect(tileValue('Total reports')).toBe('0');
  });

  it('explains a connection problem and recovers', async () => {
    let online = false;
    renderApp(
      '/dashboard',
      signedInWith({
        '/staff/dashboard?include_demo=true': () => {
          if (!online) throw new TypeError('Failed to fetch');
          return json(200, makeDashboard());
        },
      }),
    );
    expect(await screen.findByText('Could not load the dashboard')).toBeTruthy();
    expect(screen.getByText(/Please check your connection and try again/)).toBeTruthy();
    online = true;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('BEA-2026-000125')).toBeTruthy();
  });

  it('refreshes itself every minute', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let requests = 0;
    renderApp(
      '/dashboard',
      signedInWith({
        '/staff/dashboard?include_demo=true': () => {
          requests += 1;
          return json(200, makeDashboard());
        },
      }),
    );
    await screen.findByText('BEA-2026-000125');
    const before = requests;
    await act(async () => {
      vi.advanceTimersByTime(DASHBOARD_REFRESH_MS);
    });
    await waitFor(() => expect(requests).toBe(before + 1));
  });
});
