import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { anonymous, json, renderApp, session, signedIn, type Handler } from '../../test/renderApp';

afterEach(cleanup);

const BARANGAYS = [
  { id: 1, name: 'Ablayan' },
  { id: 23, name: 'Mantalongon' },
];

describe('login', () => {
  it('signs in and opens Home', async () => {
    const handler: Handler = (path) =>
      path === '/auth/login' ? json(200, session()) : anonymous(path, {});
    const { router, calls } = renderApp('/login', handler);

    await userEvent.type(await screen.findByLabelText('Email or mobile number'), '0917 123 4567');
    await userEvent.type(screen.getByLabelText('Password'), 'Safe-Pass-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/home'));
    expect(calls.find((c) => c.path === '/auth/login')?.body).toEqual({
      identifier: '0917 123 4567',
      password: 'Safe-Pass-2026',
    });
  });

  it('shows missing-field errors without calling the API', async () => {
    const { calls } = renderApp('/login', anonymous);
    await userEvent.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter your email or mobile number')).toBeTruthy();
    expect(screen.getByText('Enter your password')).toBeTruthy();
    expect(calls.some((c) => c.path === '/auth/login')).toBe(false);
  });

  it('shows the API message for wrong credentials', async () => {
    const handler: Handler = (path) =>
      path === '/auth/login'
        ? json(401, {
            error: {
              code: 'invalid_credentials',
              message: 'Incorrect email/mobile number or password.',
            },
          })
        : anonymous(path, {});
    renderApp('/login', handler);
    await userEvent.type(await screen.findByLabelText('Email or mobile number'), 'x@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Incorrect email/mobile number or password.')).toBeTruthy();
  });

  it('explains connection problems', async () => {
    const handler: Handler = (path) => {
      if (path === '/auth/login') throw new TypeError('Failed to fetch');
      return anonymous(path, {});
    };
    renderApp('/login', handler);
    await userEvent.type(await screen.findByLabelText('Email or mobile number'), 'x@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Safe-Pass-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Please check your connection and try again.')).toBeTruthy();
  });

  it('skips the login screen when already signed in', async () => {
    const { router } = renderApp('/login', signedIn);
    await waitFor(() => expect(router.state.location.pathname).toBe('/home'));
  });
});

describe('registration', () => {
  const handler: Handler = (path) => {
    if (path === '/barangays') return json(200, BARANGAYS);
    if (path === '/auth/register') return json(201, session());
    return anonymous(path, {});
  };

  async function fillValidForm() {
    await userEvent.type(await screen.findByLabelText('Full name'), 'Leona Legaspi');
    await userEvent.type(screen.getByLabelText('Mobile number'), '0917 123 4567');
    await userEvent.selectOptions(await screen.findByLabelText('Barangay'), 'Mantalongon');
    await userEvent.type(screen.getByLabelText('Password'), 'Safe-Pass-2026');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Safe-Pass-2026');
  }

  it('requires privacy consent', async () => {
    const { calls } = renderApp('/register', handler);
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      screen.getByText('You must agree to the privacy notice to create an account'),
    ).toBeTruthy();
    expect(calls.some((c) => c.path === '/auth/register')).toBe(false);
  });

  it('creates an account and opens Home', async () => {
    const { router, calls } = renderApp('/register', handler);
    await fillValidForm();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/home'));
    expect(calls.find((c) => c.path === '/auth/register')?.body).toEqual({
      full_name: 'Leona Legaspi',
      email: null,
      phone: '0917 123 4567',
      barangay_id: 23,
      password: 'Safe-Pass-2026',
      privacy_consent: true,
    });
  });

  it('shows field errors returned by the API', async () => {
    renderApp('/register', (path) =>
      path === '/auth/register'
        ? json(409, {
            error: {
              code: 'account_exists',
              message: 'An account already exists.',
              fields: { phone: 'An account with this mobile number already exists' },
            },
          })
        : handler(path, {}),
    );
    await fillValidForm();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('An account with this mobile number already exists'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Mobile number').getAttribute('aria-invalid')).toBe('true');
  });

  it('offers a retry when barangays fail to load', async () => {
    let fail = true;
    renderApp('/register', (path) => {
      if (path === '/barangays' && fail) throw new TypeError('Failed to fetch');
      return handler(path, {});
    });
    expect(await screen.findByText('Could not load barangays')).toBeTruthy();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('option', { name: 'Mantalongon' })).toBeTruthy();
  });
});

describe('profile', () => {
  it('shows account details and logs out', async () => {
    const { router, calls } = renderApp('/profile', signedIn);
    expect(await screen.findByText('Leona Legaspi')).toBeTruthy();
    expect(screen.getByText('Mantalongon')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'));
    expect(calls.some((c) => c.path === '/auth/logout')).toBe(true);
  });
});
