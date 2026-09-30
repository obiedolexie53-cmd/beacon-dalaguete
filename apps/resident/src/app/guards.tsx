import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@beacon/auth';
import { LoadingScreen } from '@beacon/ui';

export interface LoginRedirectState {
  from?: string;
}

/** Only signed-in residents may see the wrapped routes. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, endReason } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingScreen label="Signing you in…" />;
  if (status === 'anonymous' && endReason === 'logout') {
    return <Navigate to="/welcome" replace />;
  }
  if (status === 'anonymous') {
    const state: LoginRedirectState = { from: location.pathname };
    return <Navigate to="/login" replace state={state} />;
  }
  return children;
}

/** Welcome/login/registration are skipped for residents who are already signed in. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'authenticated') return <Navigate to="/home" replace />;
  return children;
}
