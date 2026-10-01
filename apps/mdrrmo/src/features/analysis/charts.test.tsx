import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, signedInWith } from '../../test/renderApp';

afterEach(cleanup);

describe('pattern visualization', () => {
  it('switches views through the URL without sending the view to the API', async () => {
    const { router, calls } = renderApp('/analysis', signedInWith());
    await screen.findByRole('table', { name: 'Hotspots' });
    await userEvent.click(screen.getByRole('button', { name: 'Charts and map' }));
    await waitFor(() => expect(router.state.location.search).toBe('?view=charts'));
    expect(await screen.findByRole('heading', { name: 'Hotspot map' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Charts and map' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(calls.some((c) => c.path.includes('view='))).toBe(false);
    expect(calls.some((c) => c.path.startsWith('/staff/analysis/incidents?'))).toBe(true);
  });

  it('shows hazard by barangay as a heatmap table with recurring locations marked', async () => {
    renderApp('/analysis?view=charts', signedInWith());
    const table = await screen.findByRole('table', {
      name: 'Records by barangay and hazard type',
    });
    const row = within(table).getByRole('row', { name: /^Mantalongon/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[0]!.textContent).toBe('3, recurring location');
    expect(cells[0]!.getAttribute('data-marked')).toBe('true');
    expect(cells[0]!.getAttribute('data-ink')).toBe('light'); // the largest count: darkest step
    expect(cells[1]!.textContent).toBe('0');
    expect(cells[1]!.style.background).toBe('');
    const totals = within(table).getAllByRole('row').at(-1)!;
    expect(within(totals).getAllByRole('cell').at(-1)!.textContent).toBe('5');
  });

  it('shows the seasonal heatmap with peak months marked', async () => {
    renderApp('/analysis?view=charts', signedInWith());
    const table = await screen.findByRole('table', {
      name: 'Records by hazard type and month of the year',
    });
    const landslide = within(table).getByRole('row', { name: /^Landslide/ });
    const cells = within(landslide).getAllByRole('cell');
    expect(cells[8]!.textContent).toBe('14, peak month'); // September
    expect(cells[9]!.textContent).toBe('8'); // October: not a peak
  });

  it('selects a hotspot from the list', async () => {
    renderApp('/analysis?view=charts', signedInWith());
    const list = await screen.findByRole('list', { name: 'Hotspots' });
    const button = within(list).getByRole('button', { name: /H1 · Landslide/ });
    await userEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('485 m')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'IMP-2025-000010' })).toBeTruthy();
    expect(screen.getByText(/not hazard zones or areas at risk/)).toBeTruthy();
  });

  it('reads the trend chart with the keyboard and offers a table', async () => {
    renderApp('/analysis?view=charts', signedInWith());
    const chart = await screen.findByRole('group', { name: /Records per month, All hazard types/ });
    chart.focus();
    fireEvent.keyDown(chart, { key: 'Home' });
    expect(await screen.findByText('Jun 2026: All hazard types 12')).toBeTruthy();
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(await screen.findByText('Jul 2026: All hazard types 30')).toBeTruthy();
    expect(
      screen.getByText(/All hazard types: no clear trend \(Mann-Kendall p = 0.600\)/),
    ).toBeTruthy();

    await userEvent.selectOptions(screen.getByLabelText('Hazard type'), 'Landslide');
    expect(screen.getByText(/Landslide: rose over the period/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Show data table' }));
    const table = screen.getByRole('table', { name: 'Records per month, Landslide' });
    expect(within(table).getByRole('row', { name: 'September 2026 20 14' })).toBeTruthy();
  });
});

describe('hotspot labels', () => {
  it('shows hazard names as text, never as HTML', async () => {
    const { makePatterns, json: toJson } = await import('../../test/renderApp');
    const base = makePatterns();
    renderApp(
      '/analysis?view=charts',
      signedInWith({
        '/staff/analysis/patterns?include_demo=true': () =>
          toJson(
            200,
            makePatterns({
              hotspots: [
                {
                  ...base.hotspots[0]!,
                  hazard: { code: 'other', name: '<img src=x onerror=alert(1)>' },
                },
              ],
            }),
          ),
      }),
    );
    await screen.findByRole('heading', { name: 'Hotspot map' });
    await waitFor(() => expect(document.querySelector('.m-hotspot-label')).not.toBeNull());
    const label = document.querySelector('.m-hotspot-label')!;
    expect(label.querySelector('img')).toBeNull();
    expect(label.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
