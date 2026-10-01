import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { OfflineBanner, PageHeader } from '@beacon/ui';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <>
      <OfflineBanner />
      <main className="r-screen bcn-stack">
        <PageHeader title={title} subtitle={subtitle} onBack={() => navigate('/welcome')} />
        {children}
      </main>
    </>
  );
}
