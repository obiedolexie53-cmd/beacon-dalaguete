import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AuthProvider } from '@beacon/auth';
import { ApiClient, type SessionResponse, type UserProfile } from '@beacon/shared';
import { routes } from '../app/routes';

export const OFFICER: UserProfile = {
  id: 's1',
  full_name: 'Juan Dela Cruz',
  email: 'officer@example.gov.ph',
  phone: null,
  role: 'mdrrmo',
  barangay: null,
  is_demo: false,
};

export const session = (user: UserProfile = OFFICER): SessionResponse => ({
  access_token: 'tok',
  token_type: 'bearer',
  expires_in: 900,
  user,
});

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

export type Handler = (path: string) => Response | Promise<Response>;

export const anonymous: Handler = (path) =>
  path === '/staff/auth/refresh'
    ? json(401, { error: { code: 'session_expired', message: 'ended' } })
    : json(404, {});

export const signedIn: Handler = (path) => {
  if (path === '/staff/auth/refresh') return json(200, session());
  if (path === '/staff/auth/logout') return new Response(null, { status: 204 });
  return json(404, {});
};

export function renderApp(path: string, handler: Handler) {
  const calls: Array<{ path: string; body: unknown }> = [];
  const client = new ApiClient({
    baseUrl: '/api/v1',
    authPath: '/staff/auth',
    fetch: (async (url: string, init: RequestInit) => {
      const apiPath = url.replace('/api/v1', '');
      calls.push({ path: apiPath, body: init.body ? JSON.parse(String(init.body)) : undefined });
      return handler(apiPath);
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
