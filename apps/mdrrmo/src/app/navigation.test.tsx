import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ANALYSIS_DISCLAIMER } from '../features/analysis/AnalysisPage';
import { anonymous, json, renderApp, session, signedIn, type Handler } from '../test/renderApp';

afterEach(cleanup);

describe('access control', () => {
  it('sends signed-out visitors to the staff login', async () => {
    const { router } = renderApp('/dashboard', anonymous);
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(screen.getByRole('heading', { name: 'MDRRMO Staff Login' })).toBeTruthy();
  });

  it('has no public registration', async () => {
    renderApp('/login', anonymous);
    await screen.findByRole('heading', { name: 'MDRRMO Staff Login' });
    expect(screen.getByText(/There is no public registration/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /create an account|register/i })).toBeNull();
  });

  it('logs in and returns to the page that was requested', async () => {
    const handler: Handler = (path) =>
      path === '/staff/auth/login' ? json(200, session()) : anonymous(path);
    const { router, calls } = renderApp('/map', handler);
    await userEvent.type(await screen.findByLabelText('Email'), 'officer@example.gov.ph');
    await userEvent.type(screen.getByLabelText('Password'), 'Officer-Pass-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/map'));
    expect(calls.some((c) => c.path === '/staff/auth/login')).toBe(true);
  });

  it('shows the error from the API when login fails', async () => {
    const handler: Handler = (path) =>
      path === '/staff/auth/login'
        ? json(401, {
            error: {
              code: 'invalid_credentials',
              message: 'Incorrect email/mobile number or password.',
            },
          })
        : anonymous(path);
    renderApp('/login', handler);
    await userEvent.type(await screen.findByLabelText('Email'), 'resident@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'whatever-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Incorrect email/mobile number or password.')).toBeTruthy();
  });

  it('signs out back to the login page', async () => {
    const { router, calls } = renderApp('/dashboard', signedIn);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(calls.some((c) => c.path === '/staff/auth/logout')).toBe(true);
  });
});

describe('console navigation', () => {
  it('redirects the root to the dashboard', async () => {
    const { router } = renderApp('/', signedIn);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Monitoring Dashboard' }),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('shows the signed-in officer', async () => {
    renderApp('/dashboard', signedIn);
    expect(await screen.findByText('Juan Dela Cruz')).toBeTruthy();
    expect(screen.getByText('MDRRMO Personnel')).toBeTruthy();
  });

  it('lists the MDRRMO sections', async () => {
    renderApp('/dashboard', signedIn);
    const nav = await screen.findByRole('navigation', { name: 'Console' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Dashboard', 'Reports', 'Disaster Map', 'Historical Reports', 'Pattern Analysis']);
  });

  it('navigates to the pattern analysis section with its disclaimer', async () => {
    const { router } = renderApp('/dashboard', signedIn);
    const nav = await screen.findByRole('navigation', { name: 'Console' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Pattern Analysis' }));
    expect(router.state.location.pathname).toBe('/analysis');
    expect(screen.getByText(ANALYSIS_DISCLAIMER)).toBeTruthy();
  });

  it('closes the mobile menu after navigating', async () => {
    renderApp('/dashboard', signedIn);
    const toggle = await screen.findByRole('button', { name: 'Open menu' });
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const nav = screen.getByRole('navigation', { name: 'Console' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Reports' }));
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });
});
