import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, makePatterns, renderApp, signedInWith } from '../../test/renderApp';

afterEach(cleanup);

const lastCall = (calls: Array<{ path: string }>) =>
  [...calls].reverse().find((c) => c.path.startsWith('/staff/analysis/patterns?'))!.path;

describe('pattern analysis', () => {
  it('shows descriptive findings with the non-prediction notice', async () => {
    renderApp('/analysis', signedInWith());
    expect(
      await screen.findByText(/Recurring landslide incidents were identified in the recorded/),
    ).toBeTruthy();
    expect(screen.getAllByText(/does not predict future disasters/).length).toBeGreaterThan(0);
    expect(screen.getByText('Recurring location')).toBeTruthy();
    expect(screen.getByText(/They are not predictions/)).toBeTruthy();
  });

  it('lists recurring locations, hotspots, seasons, trends and co-occurrence', async () => {
    renderApp('/analysis', signedInWith());
    const recurring = await screen.findByRole('table', { name: 'Recurring hazard locations' });
    expect(within(recurring).getByText('Mantalongon')).toBeTruthy();
    expect(within(recurring).getByText('Nov 2024 – Sep 2026')).toBeTruthy();

    const hotspots = screen.getByRole('table', { name: 'Hotspots' });
    expect(within(hotspots).getByText('485 m')).toBeTruthy();
    await userEvent.click(within(hotspots).getByText('3 records'));
    expect(
      within(hotspots).getByRole('link', { name: 'IMP-2025-000010' }).getAttribute('href'),
    ).toBe('/reports/IMP-2025-000010');

    const seasons = screen.getByRole('table', { name: 'Seasonal patterns' });
    expect(within(seasons).getByText('Concentrated in September, November')).toBeTruthy();
    expect(within(seasons).getByText('Too few records to test')).toBeTruthy();
    expect(within(seasons).getByText(/Sep 14, Oct 8, Nov 15/)).toBeTruthy();

    const trends = screen.getByRole('table', { name: 'Trends over time' });
    expect(within(trends).getByText('No clear trend')).toBeTruthy();
    expect(within(trends).getByText('Rose')).toBeTruthy();
    expect(within(trends).getByText('+3')).toBeTruthy();

    const together = screen.getByRole('table', { name: 'Hazards recorded together' });
    expect(within(together).getByText('2.1×')).toBeTruthy();
  });

  it('sends filters and method settings to the API through the URL', async () => {
    const { router, calls } = renderApp('/analysis', signedInWith());
    await screen.findByRole('table', { name: 'Hotspots' });
    await userEvent.click(screen.getByText('Method settings'));
    await userEvent.selectOptions(screen.getByLabelText('Hotspot distance'), '1 km');
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'import');
    await waitFor(() =>
      expect(router.state.location.search).toBe('?hotspot_distance_m=1000&source=import'),
    );
    await waitFor(() =>
      expect(lastCall(calls)).toBe(
        '/staff/analysis/patterns?source=import&hotspot_distance_m=1000&include_demo=true',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters and settings' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('explains when there are too few records', async () => {
    renderApp(
      '/analysis',
      signedInWith({
        '/staff/analysis/patterns?include_demo=true': () =>
          json(
            200,
            makePatterns({
              dataset: { ...makePatterns().dataset, total: 4, sufficient: false },
              findings: [],
            }),
          ),
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Not enough records to identify patterns' }),
    ).toBeTruthy();
    expect(screen.getByText(/4 match these filters/)).toBeTruthy();
  });

  it('offers a retry when the analysis fails', async () => {
    renderApp(
      '/analysis',
      signedInWith({
        '/staff/analysis/patterns?include_demo=true': () => {
          throw new TypeError('offline');
        },
      }),
    );
    expect(await screen.findByText('Could not run the analysis')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
