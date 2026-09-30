import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError, NETWORK_ERROR_MESSAGE } from './client';
import type { SessionResponse } from './types';

const session = (token: string): SessionResponse => ({
  access_token: token,
  token_type: 'bearer',
  expires_in: 900,
  user: {
    id: 'u1',
    full_name: 'Leona Legaspi',
    email: 'leona@example.com',
    phone: null,
    role: 'resident',
    barangay: { id: 1, name: 'Mantalongon' },
    is_demo: false,
  },
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function makeClient(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => handler(url, init));
  const client = new ApiClient({
    baseUrl: '/api/v1',
    authPath: '/auth',
    fetch: fetchMock as unknown as typeof fetch,
  });
  return { client, fetchMock };
}

describe('ApiClient', () => {
  it('sends the access token after login', async () => {
    const { client, fetchMock } = makeClient((url) =>
      url.endsWith('/login') ? json(200, session('tok-1')) : json(200, { ok: true }),
    );
    await client.login('leona@example.com', 'secret');
    await client.get('/me');
    const headers = fetchMock.mock.calls[1]![1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-1');
  });

  it('refreshes once on 401 and retries the request', async () => {
    let meCalls = 0;
    const { client } = makeClient((url, init) => {
      if (url.endsWith('/refresh')) return json(200, session('tok-2'));
      meCalls += 1;
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer tok-2' ? json(200, { name: 'ok' }) : json(401, {});
    });
    await expect(client.get('/me')).resolves.toEqual({ name: 'ok' });
    expect(meCalls).toBe(2);
  });

  it('ends the session when refresh fails', async () => {
    const { client } = makeClient((url) =>
      url.endsWith('/refresh')
        ? json(401, { error: { code: 'session_expired', message: 'ended' } })
        : json(401, { error: { code: 'not_authenticated', message: 'Please log in' } }),
    );
    const listener = vi.fn();
    client.onSessionChange(listener);
    await expect(client.get('/me')).rejects.toMatchObject({ code: 'not_authenticated' });
    expect(listener).toHaveBeenCalledWith(null);
  });

  it('shares one in-flight refresh between concurrent callers', async () => {
    const { client, fetchMock } = makeClient(() => json(200, session('tok')));
    await Promise.all([client.refresh(), client.refresh(), client.refresh()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once when another tab is mid-refresh', async () => {
    let calls = 0;
    const { client } = makeClient(() => {
      calls += 1;
      return calls === 1
        ? json(409, { error: { code: 'refresh_in_progress', message: 'retry' } })
        : json(200, session('tok-3'));
    });
    await expect(client.refresh()).resolves.toMatchObject({ access_token: 'tok-3' });
  });

  it('turns network failures into a friendly error', async () => {
    const { client } = makeClient(() => Promise.reject(new TypeError('Failed to fetch')));
    const error = await client.get('/barangays').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'network_error', message: NETWORK_ERROR_MESSAGE });
  });

  it('sends uploads as multipart form data', async () => {
    const { client, fetchMock } = makeClient(() => json(201, { id: 'm1' }));
    const form = new FormData();
    form.append('file', new Blob(['x'], { type: 'image/jpeg' }), 'photo.jpg');
    await client.upload('/me/reports/BEA-2026-000124/media', form);
    const init = fetchMock.mock.calls[0]![1];
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('exposes field errors from the API', async () => {
    const { client } = makeClient(() =>
      json(422, {
        error: { code: 'validation_error', message: 'Check', fields: { phone: 'Invalid' } },
      }),
    );
    await expect(client.startSession('/auth/register', {})).rejects.toMatchObject({
      fields: { phone: 'Invalid' },
    });
  });

  it('downloads files with the suggested name and reports errors as usual', async () => {
    const { client } = makeClient((url) =>
      url.includes('export')
        ? new Response('a,b\n1,2\n', {
            status: 200,
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': 'attachment; filename="beacon-incidents.csv"',
            },
          })
        : json(403, { error: { code: 'forbidden', message: 'Staff only' } }),
    );
    const file = await client.download('/staff/analysis/incidents/export');
    expect(file.filename).toBe('beacon-incidents.csv');
    expect(await file.blob.text()).toBe('a,b\n1,2\n');
    await expect(client.download('/other')).rejects.toMatchObject({ code: 'forbidden' });
  });
});
