import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { ApiClient, type SessionResponse } from '@beacon/shared';
import { AuthProvider, useAuth } from './AuthProvider';

const session: SessionResponse = {
  access_token: 'tok',
  token_type: 'bearer',
  expires_in: 900,
  user: {
    id: 'u1',
    full_name: 'Leona Legaspi',
    email: 'leona@example.com',
    phone: null,
    role: 'resident',
    barangay: null,
    is_demo: false,
  },
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="name">{auth.user?.full_name ?? ''}</span>
      <span data-testid="expired">{String(auth.sessionExpired)}</span>
      <button onClick={() => void auth.logout()}>logout</button>
    </div>
  );
}

function setup(handler: (url: string) => Response) {
  const client = new ApiClient({
    baseUrl: '/api/v1',
    authPath: '/auth',
    fetch: (async (url: string) => handler(url)) as unknown as typeof fetch,
  });
  render(
    <AuthProvider client={client}>
      <Probe />
    </AuthProvider>,
  );
  return client;
}

afterEach(cleanup);

describe('AuthProvider', () => {
  it('restores an existing session on load', async () => {
    setup(() => json(200, session));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('name').textContent).toBe('Leona Legaspi');
  });

  it('is anonymous when there is no session', async () => {
    setup(() => json(401, { error: { code: 'session_expired', message: 'x' } }));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(screen.getByTestId('expired').textContent).toBe('false');
  });

  it('flags an expired session but not a deliberate logout', async () => {
    let refreshOk = true;
    const client = setup((url) => {
      if (url.endsWith('/refresh'))
        return refreshOk ? json(200, session) : json(401, { error: { code: 'session_expired' } });
      if (url.endsWith('/logout')) return new Response(null, { status: 204 });
      return json(401, { error: { code: 'not_authenticated' } });
    });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    refreshOk = false;
    await act(async () => {
      await client.get('/me').catch(() => undefined);
    });
    expect(screen.getByTestId('status').textContent).toBe('anonymous');
    expect(screen.getByTestId('expired').textContent).toBe('true');

    refreshOk = true;
    await act(async () => {
      await client.refresh();
    });
    await act(async () => {
      screen.getByText('logout').click();
    });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(screen.getByTestId('expired').textContent).toBe('false');
  });

  it('treats being offline at start-up as signed out', async () => {
    const client = new ApiClient({
      baseUrl: '/api/v1',
      authPath: '/auth',
      fetch: vi.fn(() => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch,
    });
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
  });
});
