import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AuthProvider } from '@beacon/auth';
import { ApiClient, type SessionResponse, type UserProfile } from '@beacon/shared';
import { routes } from '../app/routes';

export const RESIDENT: UserProfile = {
  id: 'u1',
  full_name: 'Leona Legaspi',
  email: 'leona@example.com',
  phone: '+639171234567',
  role: 'resident',
  barangay: { id: 23, name: 'Mantalongon' },
  is_demo: false,
};

export const session = (user: UserProfile = RESIDENT): SessionResponse => ({
  access_token: 'tok',
  token_type: 'bearer',
  expires_in: 900,
  user,
});

export const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), { status });

export type Handler = (path: string, init: RequestInit) => Response | Promise<Response>;

/** A handler for a visitor with no saved session. */
export const anonymous: Handler = (path) =>
  path === '/auth/refresh'
    ? json(401, { error: { code: 'session_expired', message: 'ended' } })
    : json(404, {});

/** A handler for a signed-in resident. */
export const signedIn: Handler = (path) => {
  if (path === '/auth/refresh') return json(200, session());
  if (path === '/auth/logout') return new Response(null, { status: 204 });
  return json(404, {});
};

/** Render the resident app at `path` against a fake API. */
export function renderApp(path: string, handler: Handler) {
  const calls: Array<{ path: string; body: unknown }> = [];
  const client = new ApiClient({
    baseUrl: '/api/v1',
    authPath: '/auth',
    fetch: (async (url: string, init: RequestInit) => {
      const apiPath = url.replace('/api/v1', '');
      calls.push({ path: apiPath, body: init.body ? JSON.parse(String(init.body)) : undefined });
      return handler(apiPath, init);
    }) as unknown as typeof fetch,
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AuthProvider client={client}>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return { router, calls };
}
