import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@beacon/auth';
import { Logo } from '@beacon/ui';

export const SPLASH_DURATION_MS = 1500;

/** Shows the brand briefly while the saved session is restored, then routes accordingly. */
export function SplashScreen() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumElapsed(true), SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!minimumElapsed || status === 'loading') return;
    navigate(status === 'authenticated' ? '/home' : '/welcome', { replace: true });
  }, [minimumElapsed, status, navigate]);

  return (
    <main className="r-hero r-splash r-screen">
      <Logo size={72} inverse showWordmark={false} />
      <h1>BEACON</h1>
      <p className="r-splash__tagline">Community Disaster Reporting · Dalaguete, Cebu</p>
    </main>
  );
}
