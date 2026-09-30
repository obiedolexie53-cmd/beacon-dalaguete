import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, makeAnalysis, renderApp, signedInWith } from '../../test/renderApp';
import { matchPeriod, periodRange } from './periods';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const lastAnalysisCall = (calls: Array<{ path: string }>) =>
  [...calls].reverse().find((c) => c.path.startsWith('/staff/analysis/incidents?'))!.path;

describe('historical reports', () => {
  it('summarises the recorded dataset in descriptive language', async () => {
    renderApp('/history', signedInWith());
    expect(await screen.findByRole('heading', { name: 'Dataset' })).toBeTruthy();
    expect(screen.getByText(/contains 5 MDRRMO-confirmed records/)).toBeTruthy();
    expect(screen.getByText(/Landslide was the most frequently recorded hazard type/)).toBeTruthy();
    expect(screen.getByText(/Mantalongon had the most records/)).toBeTruthy();
    expect(screen.getByText(/More records fell in November/)).toBeTruthy();
    expect(screen.getByText(/does not predict future disasters/)).toBeTruthy();
    expect(screen.getByText('Includes DEMO DATA')).toBeTruthy();
    // Nothing on the page forecasts.
    expect(document.body.textContent).not.toMatch(/\bwill (experience|occur|happen)/i);
  });

  it('names every leader when counts are tied', async () => {
    const base = makeAnalysis();
    renderApp(
      '/history',
      signedInWith({
        '/staff/analysis/incidents?include_demo=true': () =>
          json(
            200,
            makeAnalysis({
              by_hazard: base.by_hazard.map((h) => ({ ...h, count: 2, share: 0.5 })),
              by_barangay: base.by_barangay.map((b) => ({ ...b, count: 2 })),
            }),
          ),
      }),
    );
    expect(await screen.findByText(/Landslide and Flood were recorded equally often/)).toBeTruthy();
    expect(screen.getByText(/Mantalongon and Poblacion had the most records/)).toBeTruthy();
  });

  it('shows the counts as tables screen readers can read', async () => {
    renderApp('/history', signedInWith());
    const hazards = await screen.findByRole('table', { name: 'Records by hazard type' });
    const landslide = within(hazards).getByRole('row', { name: /Landslide/ });
    expect(within(landslide).getByText('3')).toBeTruthy();
    expect(within(landslide).getByText('60%')).toBeTruthy();
    const months = screen.getByRole('table', { name: 'Records per month' });
    expect(within(months).getByRole('row', { name: 'October 2025 0' })).toBeTruthy();
    expect(screen.getByText(/1 record had no time and is not shown/)).toBeTruthy();
  });

  it('filters through the URL, confirmed records by default', async () => {
    const { router, calls } = renderApp('/history', signedInWith());
    await screen.findByRole('heading', { name: 'Dataset' });
    expect(lastAnalysisCall(calls)).toBe('/staff/analysis/incidents?include_demo=true');
    await userEvent.selectOptions(screen.getByLabelText('Records'), 'all');
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'import');
    await userEvent.selectOptions(await screen.findByLabelText('Hazard'), 'Landslide');
    await waitFor(() =>
      expect(router.state.location.search).toBe('?scope=all&source=import&hazard=landslide'),
    );
    await waitFor(() =>
      expect(lastAnalysisCall(calls)).toBe(
        '/staff/analysis/incidents?scope=all&hazard=landslide&source=import&include_demo=true',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('sets dates from a period preset', async () => {
    const { router } = renderApp('/history', signedInWith());
    await userEvent.selectOptions(await screen.findByLabelText('Period'), 'Last year');
    const year = new Date().getFullYear() - 1;
    await waitFor(() =>
      expect(router.state.location.search).toBe(`?date_from=${year}-01-01&date_to=${year}-12-31`),
    );
    expect((screen.getByLabelText('Period') as HTMLSelectElement).value).toBe('last_year');
  });

  it('explains when nothing matches', async () => {
    renderApp(
      '/history',
      signedInWith({
        '/staff/analysis/incidents?include_demo=true': () =>
          json(
            200,
            makeAnalysis({
              dataset: { ...makeAnalysis().dataset, total: 0 },
              by_hazard: [],
              by_barangay: [],
            }),
          ),
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'No records match these filters' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export CSV/ })).toHaveProperty('disabled', true);
  });

  it('exports the filtered records as CSV', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { calls } = renderApp(
      '/history?source=import',
      signedInWith({
        '/staff/analysis/incidents/export?source=import&include_demo=true': () =>
          new Response('reference_no\nIMP-2025-000001\n', {
            status: 200,
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': 'attachment; filename="beacon-incidents-x.csv"',
            },
          }),
      }),
    );
    await screen.findByRole('heading', { name: 'Dataset' });
    await userEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    expect(calls.some((c) => c.path.startsWith('/staff/analysis/incidents/export?'))).toBe(true);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('beacon-incidents-x.csv');
  });

  it('reports a failed export', async () => {
    renderApp(
      '/history',
      signedInWith({
        '/staff/analysis/incidents/export?include_demo=true': () => {
          throw new TypeError('offline');
        },
      }),
    );
    await screen.findByRole('heading', { name: 'Dataset' });
    await userEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Export failed. Please check your connection/)).toBeTruthy();
  });
});

describe('period presets', () => {
  const today = new Date(2026, 8, 30); // 30 Sep 2026
  it('computes whole-month ranges', () => {
    expect(periodRange('12m', today)).toEqual({ from: '2025-10-01', to: '2026-09-30' });
    expect(periodRange('24m', today)).toEqual({ from: '2024-10-01', to: '2026-09-30' });
    expect(periodRange('this_year', today)).toEqual({ from: '2026-01-01', to: '2026-09-30' });
    expect(periodRange('all', today)).toEqual({ from: null, to: null });
    expect(periodRange('nonsense', today)).toBeNull();
  });
  it('recognises presets and custom dates', () => {
    expect(matchPeriod(null, null, today)).toBe('all');
    expect(matchPeriod('2025-10-01', '2026-09-30', today)).toBe('12m');
    expect(matchPeriod('2025-10-02', null, today)).toBe('custom');
  });
});
