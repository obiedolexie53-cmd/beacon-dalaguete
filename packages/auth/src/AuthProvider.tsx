import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ApiClient, SessionResponse, UserProfile } from '@beacon/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
/** Why the last session ended: the user logged out, or it expired/was revoked. */
export type SessionEndReason = 'logout' | 'expired' | null;

export interface AuthContextValue {
  /** The app's API client, for feature requests made on behalf of the signed-in user. */
  client: ApiClient;
  status: AuthStatus;
  user: UserProfile | null;
  /** True when a session ended on its own (expired/revoked), not by logging out. */
  sessionExpired: boolean;
  endReason: SessionEndReason;
  login(identifier: string, password: string): Promise<UserProfile>;
  /** Start a session from another endpoint, e.g. resident registration. */
  startSession(path: string, body: unknown): Promise<UserProfile>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the signed-in user for one app. On load it silently restores the
 * session from the httpOnly refresh cookie. If there is none, the user is
 * anonymous.
 */
export function AuthProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [endReason, setEndReason] = useState<SessionEndReason>(null);
  const loggingOut = useRef(false);
  const hadSession = useRef(false);

  useEffect(() => {
    const unsubscribe = client.onSessionChange((session: SessionResponse | null) => {
      if (session) {
        hadSession.current = true;
        setUser(session.user);
        setStatus('authenticated');
        setEndReason(null);
      } else {
        if (hadSession.current) setEndReason(loggingOut.current ? 'logout' : 'expired');
        hadSession.current = false;
        setUser(null);
        setStatus('anonymous');
      }
    });
    client.refresh().catch(() => {
      // Offline at start-up: treat as signed out. The login screen explains the connection problem.
      setStatus((current) => (current === 'loading' ? 'anonymous' : current));
    });
    return unsubscribe;
  }, [client]);

  const login = useCallback(
    async (identifier: string, password: string) => (await client.login(identifier, password)).user,
    [client],
  );

  const startSession = useCallback(
    async (path: string, body: unknown) => (await client.startSession(path, body)).user,
    [client],
  );

  const logout = useCallback(async () => {
    loggingOut.current = true;
    try {
      await client.logout();
    } finally {
      loggingOut.current = false;
    }
  }, [client]);

  const value = useMemo(
    () => ({
      client,
      status,
      user,
      sessionExpired: endReason === 'expired',
      endReason,
      login,
      startSession,
      logout,
    }),
    [client, status, user, endReason, login, startSession, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** The API client of the surrounding AuthProvider. */
export function useApiClient(): ApiClient {
  return useAuth().client;
}
