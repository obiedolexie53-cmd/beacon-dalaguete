import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAP_DATA, json, renderApp, signedInWith } from '../../test/renderApp';

afterEach(cleanup);

const lastMapCall = (calls: Array<{ path: string }>) =>
  [...calls].reverse().find((c) => c.path.startsWith('/staff/map/reports?'))!.path;

function marker(label: string): HTMLElement {
  return document.querySelector<HTMLElement>(`.leaflet-marker-icon[title="${label}"]`)!;
}

describe('disaster map', () => {
  it('plots located reports with labels that name hazard, status and barangay', async () => {
    renderApp('/map', signedInWith());
    expect(await screen.findByText('2 reports on the map')).toBeTruthy();
    await waitFor(() => expect(document.querySelectorAll('.leaflet-marker-icon')).toHaveLength(2));
    expect(
      marker('BEA-2026-000125: Flood, For Verification / Needs Clarification, Poblacion'),
    ).toBeTruthy();
    expect(marker('BEA-2026-000123: Landslide, Under Verification, Mantalongon')).toBeTruthy();
  });

  it('shows a summary with a review link when a marker is selected', async () => {
    renderApp('/map', signedInWith());
    await screen.findByText('2 reports on the map');
    await waitFor(() => expect(document.querySelectorAll('.leaflet-marker-icon')).toHaveLength(2));
    await userEvent.click(marker('BEA-2026-000123: Landslide, Under Verification, Mantalongon'));

    const summary = await screen.findByLabelText('Summary of report BEA-2026-000123');
    expect(within(summary).getByText('Landslide')).toBeTruthy();
    expect(within(summary).getByText('DEMO')).toBeTruthy();
    expect(within(summary).getByText('Under Verification')).toBeTruthy();
    expect(within(summary).getByText('Mantalongon')).toBeTruthy();
    expect(within(summary).getByRole('link', { name: 'Review report' }).getAttribute('href')).toBe(
      '/reports/BEA-2026-000123',
    );
    await userEvent.click(within(summary).getByRole('button', { name: 'Close summary' }));
    expect(screen.getByText('Select a marker to see a summary of the report.')).toBeTruthy();
  });

  it('opens a marker from the keyboard', async () => {
    renderApp('/map', signedInWith());
    await screen.findByText('2 reports on the map');
    await waitFor(() => expect(document.querySelectorAll('.leaflet-marker-icon')).toHaveLength(2));
    const first = marker(
      'BEA-2026-000125: Flood, For Verification / Needs Clarification, Poblacion',
    );
    expect(first.getAttribute('tabindex')).toBe('0');
    first.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByLabelText('Summary of report BEA-2026-000125')).toBeTruthy();
  });

  it('filters by hazard, barangay, date and status', async () => {
    const { router, calls } = renderApp('/map', signedInWith());
    await screen.findByText('2 reports on the map');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Verified');
    await userEvent.selectOptions(await screen.findByLabelText('Hazard'), 'Flood');
    await userEvent.selectOptions(await screen.findByLabelText('Barangay'), 'Poblacion');
    await waitFor(() => expect(lastMapCall(calls)).toContain('barangay_id=28'));
    expect(lastMapCall(calls)).toContain('status=verified');
    expect(lastMapCall(calls)).toContain('hazard=flood');
    expect(router.state.location.search).toBe('?status=verified&hazard=flood&barangay_id=28');
  });

  it('counts reports without a map pin and links to them', async () => {
    renderApp('/map?hazard=flood', signedInWith());
    expect(await screen.findByText(/1 matching report has no map pin/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View in Reports' }).getAttribute('href')).toBe(
      '/reports?hazard=flood',
    );
  });

  it('explains the marker colours and icons in a legend', async () => {
    renderApp('/map', signedInWith());
    const legend = await screen.findByLabelText('Map legend');
    for (const label of ['Submitted', 'Under Verification', 'Verified', 'Resolved']) {
      expect(within(legend).getByText(label)).toBeTruthy();
    }
    expect(within(legend).getByText('Icon inside the marker: hazard type')).toBeTruthy();
  });

  it('offers the same reports as a list', async () => {
    renderApp('/map', signedInWith());
    await screen.findByText('2 reports on the map');
    await userEvent.click(screen.getByRole('button', { name: 'Show as list' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(MAP_DATA.points.length + 1);
    await userEvent.click(within(table).getAllByRole('button', { name: 'Show on map' })[0]!);
    expect(await screen.findByLabelText('Summary of report BEA-2026-000125')).toBeTruthy();
  });

  it('warns when not every report fits on the map', async () => {
    renderApp(
      '/map',
      signedInWith({
        '/staff/map/reports?include_demo=true': () => json(200, { ...MAP_DATA, truncated: true }),
      }),
    );
    expect(await screen.findByText('Not every report is shown')).toBeTruthy();
  });

  it('explains a connection problem', async () => {
    renderApp(
      '/map',
      signedInWith({
        '/staff/map/reports?include_demo=true': () => {
          throw new TypeError('Failed to fetch');
        },
      }),
    );
    expect(await screen.findByText('Could not load the map data')).toBeTruthy();
  });
});
