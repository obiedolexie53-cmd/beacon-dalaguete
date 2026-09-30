import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Logo } from '@beacon/ui';

export const SPLASH_DURATION_MS = 1500;

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(
      () => navigate('/welcome', { replace: true }),
      SPLASH_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <main className="r-hero r-splash r-screen">
      <Logo size={72} inverse showWordmark={false} />
      <h1>BEACON</h1>
      <p className="r-splash__tagline">Community Disaster Reporting · Dalaguete, Cebu</p>
    </main>
  );
}
