import type { SessionResponse } from './types';

export const NETWORK_ERROR_MESSAGE = 'Please check your connection and try again.';

/** Error thrown for every failed request. `code` matches the API's error codes. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  get isNetworkError(): boolean {
    return this.code === 'network_error';
  }
}

export interface ApiClientOptions {
  /** e.g. '/api/v1' */
  baseUrl: string;
  /** Auth routes for this app: '/auth' (residents) or '/staff/auth' (MDRRMO). */
  authPath: string;
  fetch?: typeof fetch;
}

type SessionListener = (session: SessionResponse | null) => void;

const REFRESH_LOCK = 'beacon-session-refresh';
const RACE_RETRY_DELAY_MS = 400;

/**
 * Small fetch wrapper for the BEACON API.
 *
 * - The access token is kept in memory only (never localStorage).
 * - The refresh token is an httpOnly cookie the browser sends to the auth path.
 * - On a 401 the client refreshes once and retries. Refreshes are serialized
 *   across tabs with the Web Locks API, so two tabs never rotate the same token.
 */
export class ApiClient {
  private accessToken: string | null = null;
  private refreshing: Promise<SessionResponse | null> | null = null;
  private listeners = new Set<SessionListener>();
  private readonly options: ApiClientOptions;

  constructor(options: ApiClientOptions) {
    this.options = options;
  }

  /** Notified whenever a session starts, refreshes or ends. */
  onSessionChange(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async login(identifier: string, password: string): Promise<SessionResponse> {
    const session = await this.request<SessionResponse>(
      'POST',
      `${this.options.authPath}/login`,
      { identifier, password },
      { auth: false },
    );
    this.setSession(session);
    return session;
  }

  async startSession(path: string, body: unknown): Promise<SessionResponse> {
    const session = await this.request<SessionResponse>('POST', path, body, { auth: false });
    this.setSession(session);
    return session;
  }

  async logout(): Promise<void> {
    try {
      await this.request('POST', `${this.options.authPath}/logout`, undefined, { auth: false });
    } finally {
      this.setSession(null);
    }
  }

  /** Restore or renew the session from the refresh cookie. Resolves null if there is none. */
  refresh(): Promise<SessionResponse | null> {
    this.refreshing ??= this.withRefreshLock(() => this.doRefresh()).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(retryOnRace = true): Promise<SessionResponse | null> {
    try {
      const session = await this.request<SessionResponse>(
        'POST',
        `${this.options.authPath}/refresh`,
        undefined,
        { auth: false },
      );
      this.setSession(session);
      return session;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'refresh_in_progress' && retryOnRace) {
        await new Promise((resolve) => setTimeout(resolve, RACE_RETRY_DELAY_MS));
        return this.doRefresh(false);
      }
      if (error instanceof ApiError && error.isNetworkError) throw error;
      this.setSession(null);
      return null;
    }
  }

  private withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    return locks ? locks.request(REFRESH_LOCK, task) : task();
  }

  private setSession(session: SessionResponse | null): void {
    this.accessToken = session?.access_token ?? null;
    for (const listener of this.listeners) listener(session);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    { auth = true, retried = false }: { auth?: boolean; retried?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    let response: Response;
    try {
      response = await (this.options.fetch ?? fetch)(`${this.options.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
      });
    } catch {
      throw new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE);
    }

    if (response.status === 401 && auth && !retried) {
      const session = await this.refresh();
      if (session) return this.request<T>(method, path, body, { auth, retried: true });
    }

    if (response.status === 204) return undefined as T;

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = (
        data as {
          error?: { code?: string; message?: string; fields?: Record<string, string> };
        } | null
      )?.error;
      throw new ApiError(
        response.status,
        error?.code ?? 'unexpected_error',
        error?.message ?? 'Something went wrong. Please try again.',
        error?.fields,
      );
    }
    return data as T;
  }
}
