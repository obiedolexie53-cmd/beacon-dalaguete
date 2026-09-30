import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { routes } from './routes';
import { SPLASH_DURATION_MS } from '../features/onboarding/SplashScreen';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('resident flow', () => {
  it('goes from splash to welcome', () => {
    vi.useFakeTimers();
    const router = renderAt('/');
    expect(screen.getByRole('heading', { name: 'BEACON' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(SPLASH_DURATION_MS);
    });
    expect(router.state.location.pathname).toBe('/welcome');
  });

  it('offers registration and login from the welcome screen', async () => {
    const router = renderAt('/welcome');
    expect(screen.getByRole('link', { name: 'Create an account' })).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: 'Log in' }));
    expect(router.state.location.pathname).toBe('/login');
  });
});

describe('bottom navigation', () => {
  it('has the five resident sections in order', () => {
    renderAt('/home');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Home', 'Report', 'My Reports', 'Notifications', 'Profile']);
  });

  it('marks the current section and navigates between sections', async () => {
    const router = renderAt('/home');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe(
      'page',
    );

    await userEvent.click(within(nav).getByRole('link', { name: 'My Reports' }));
    expect(router.state.location.pathname).toBe('/my-reports');
    expect(screen.getByRole('heading', { name: 'No reports yet' })).toBeTruthy();
  });
});

describe('screens', () => {
  it('labels the sample report on Home as demo data', () => {
    renderAt('/home');
    const card = screen.getByRole('article', { name: 'Report BEA-2026-000123' });
    expect(within(card).getByText('DEMO DATA')).toBeTruthy();
    expect(within(card).getByText('Under Verification')).toBeTruthy();
  });

  it('shows the evidence safety reminder on the report screen', () => {
    renderAt('/report');
    expect(screen.getByText('Do not put yourself in danger to obtain evidence.')).toBeTruthy();
  });

  it('shows a not-found screen for unknown paths', () => {
    renderAt('/does-not-exist');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});
