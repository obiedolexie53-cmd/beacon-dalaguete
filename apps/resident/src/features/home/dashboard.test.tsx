import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DEMO_REPORT,
  json,
  makeDashboard,
  makeReport,
  renderApp,
  signedInWith,
} from '../../test/renderApp';

afterEach(cleanup);

function statValue(label: string): string | null | undefined {
  const term = screen.getByText(label, { selector: 'dt' });
  return term.nextElementSibling?.textContent;
}

describe('resident dashboard', () => {
  it('greets the resident by first name and barangay', async () => {
    renderApp('/home', signedInWith());
    expect(await screen.findByRole('heading', { level: 1, name: /Leona/ })).toBeTruthy();
    expect(screen.getByText('Brgy. Mantalongon, Dalaguete, Cebu')).toBeTruthy();
  });

  it('shows the resident’s status counts', async () => {
    const reports = [
      makeReport({ id: 'a', status: 'submitted' }),
      makeReport({ id: 'b', status: 'needs_clarification' }),
      makeReport({ id: 'c', status: 'verified' }),
    ];
    renderApp(
      '/home',
      signedInWith({
        '/me/dashboard': () => json(200, makeDashboard(reports, { resolved: 4, total: 7 })),
      }),
    );
    await screen.findAllByRole('article');
    expect(statValue('Total reports')).toBe('7');
    expect(statValue('In review')).toBe('2');
    expect(statValue('Verified')).toBe('1');
    expect(statValue('Resolved')).toBe('4');
  });

  it('lists recent reports and labels demo data', async () => {
    renderApp('/home', signedInWith());
    const demo = await screen.findByRole('article', { name: 'Report BEA-2026-000123' });
    expect(within(demo).getByText('DEMO DATA')).toBeTruthy();
    expect(within(demo).getByText('Landslide')).toBeTruthy();
    expect(within(demo).getByText(/September 28, 2026, 4:35 PM/)).toBeTruthy();
    expect(within(demo).getByText('Under Verification')).toBeTruthy();

    const real = screen.getByRole('article', { name: 'Report BEA-2026-000124' });
    expect(within(real).queryByText('DEMO DATA')).toBeNull();
    expect(screen.getByText(/fictional samples for evaluation/)).toBeTruthy();
  });

  it('highlights reports that need clarification', async () => {
    const reports = [makeReport({ status: 'needs_clarification' })];
    renderApp('/home', signedInWith({ '/me/dashboard': () => json(200, makeDashboard(reports)) }));
    expect(await screen.findByText('1 report needs clarification')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open My Reports' })).toBeTruthy();
  });

  it('shows an empty state for a new resident', async () => {
    renderApp('/home', signedInWith({ '/me/dashboard': () => json(200, makeDashboard([])) }));
    expect(await screen.findByRole('heading', { name: 'No reports yet' })).toBeTruthy();
    expect(statValue('Total reports')).toBe('0');
    expect(screen.queryByRole('link', { name: 'View all' })).toBeNull();
    expect(screen.queryByText(/fictional samples/)).toBeNull();
  });

  it('recovers from a connection error', async () => {
    let online = false;
    renderApp(
      '/home',
      signedInWith({
        '/me/dashboard': () => {
          if (!online) throw new TypeError('Failed to fetch');
          return json(200, makeDashboard([DEMO_REPORT]));
        },
      }),
    );
    expect(await screen.findByText('Could not load your reports')).toBeTruthy();
    expect(screen.getByText('Please check your connection and try again.')).toBeTruthy();
    online = true;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('article', { name: 'Report BEA-2026-000123' })).toBeTruthy();
  });
});

describe('my reports', () => {
  it('lists the resident’s reports with a count', async () => {
    renderApp('/my-reports', signedInWith());
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(screen.getByText(/2 reports · Only you can see these/)).toBeTruthy();
  });

  it('shows an empty state with a report button', async () => {
    renderApp(
      '/my-reports',
      signedInWith({ '/me/reports?limit=50': () => json(200, { items: [], total: 0 }) }),
    );
    expect(await screen.findByRole('heading', { name: 'No reports yet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Report a Disaster' })).toBeTruthy();
  });

  it('shows the error from the API', async () => {
    renderApp(
      '/my-reports',
      signedInWith({
        '/me/reports?limit=50': () =>
          json(500, { error: { code: 'server_error', message: 'The server had a problem.' } }),
      }),
    );
    expect(await screen.findByText('The server had a problem.')).toBeTruthy();
  });
});
