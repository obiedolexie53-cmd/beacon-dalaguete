import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SPLASH_DURATION_MS } from '../features/onboarding/SplashScreen';
import { anonymous, renderApp, signedIn } from '../test/renderApp';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('resident flow', () => {
  it('goes from splash to welcome when signed out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { router } = renderApp('/', anonymous);
    expect(screen.getByRole('heading', { name: 'BEACON' })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(SPLASH_DURATION_MS);
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'));
  });

  it('goes from splash straight to home when a session is restored', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { router } = renderApp('/', signedIn);
    await act(async () => {
      vi.advanceTimersByTime(SPLASH_DURATION_MS);
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'));
  });

  it('offers registration and login from the welcome screen', async () => {
    const { router } = renderApp('/welcome', anonymous);
    expect(await screen.findByRole('link', { name: 'Create an account' })).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: 'Log in' }));
    expect(router.state.location.pathname).toBe('/login');
  });

  it('sends signed-out visitors to login', async () => {
    const { router } = renderApp('/my-reports', anonymous);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('bottom navigation', () => {
  it('has the five resident sections in order', async () => {
    renderApp('/home', signedIn);
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Home', 'Report', 'My Reports', 'Notifications', 'Profile']);
  });

  it('marks the current section and navigates between sections', async () => {
    const { router } = renderApp('/home', signedIn);
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe(
      'page',
    );
    await userEvent.click(within(nav).getByRole('link', { name: 'My Reports' }));
    expect(router.state.location.pathname).toBe('/my-reports');
    expect(screen.getByRole('heading', { name: 'My Reports' })).toBeTruthy();
  });
});

describe('screens', () => {
  it('shows the evidence safety reminder on the report screen', async () => {
    renderApp('/report', signedIn);
    expect(
      await screen.findByText('Do not put yourself in danger to obtain evidence.'),
    ).toBeTruthy();
  });

  it('shows a not-found screen for unknown paths', () => {
    renderApp('/does-not-exist', anonymous);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});
