import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@beacon/auth';
import { LoadingScreen } from '@beacon/ui';

export interface LoginRedirectState {
  from?: string;
}

/** Only signed-in MDRRMO personnel may see the console. */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingScreen label="Checking your session…" />;
  if (status === 'anonymous') {
    const state: LoginRedirectState = { from: location.pathname };
    return <Navigate to="/login" replace state={state} />;
  }
  return children;
}
