import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { routes } from './routes';
import { ANALYSIS_DISCLAIMER } from '../features/analysis/AnalysisPage';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(cleanup);

describe('console navigation', () => {
  it('redirects the root to the dashboard', () => {
    const router = renderAt('/');
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(screen.getByRole('heading', { level: 1, name: 'Monitoring Dashboard' })).toBeTruthy();
  });

  it('lists the MDRRMO sections', () => {
    renderAt('/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Console' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Dashboard', 'Reports', 'Disaster Map', 'Historical Reports', 'Pattern Analysis']);
  });

  it('navigates to the pattern analysis section with its disclaimer', async () => {
    const router = renderAt('/dashboard');
    const nav = screen.getByRole('navigation', { name: 'Console' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Pattern Analysis' }));
    expect(router.state.location.pathname).toBe('/analysis');
    expect(screen.getByText(ANALYSIS_DISCLAIMER)).toBeTruthy();
  });

  it('toggles the mobile menu', async () => {
    renderAt('/dashboard');
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeTruthy();
  });
});

describe('dashboard', () => {
  it('shows the required columns and labels the sample row as demo data', () => {
    renderAt('/dashboard');
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Report ID', 'Hazard', 'Barangay', 'Date/time', 'Status', 'Action']);
    expect(screen.getByRole('cell', { name: 'BEA-2026-000123' })).toBeTruthy();
    expect(screen.getAllByText('DEMO DATA').length).toBeGreaterThan(0);
  });

  it('shows the five status counts', () => {
    renderAt('/dashboard');
    for (const label of [
      'Total reports',
      'New reports',
      'Under verification',
      'Verified',
      'Resolved',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});

describe('staff login', () => {
  it('states that there is no public registration', () => {
    renderAt('/login');
    expect(screen.getByText('No public registration')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /create an account|register/i })).toBeNull();
  });
});

describe('mobile menu', () => {
  it('closes after navigating to another section', async () => {
    renderAt('/dashboard');
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const nav = screen.getByRole('navigation', { name: 'Console' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Reports' }));
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });
});
