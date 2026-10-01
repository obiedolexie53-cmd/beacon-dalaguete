import type { ReactNode } from 'react';
import { Card, EmptyState, PageHeader } from '@beacon/ui';

/** Placeholder page body for console sections built in later phases. */
export function ComingSoon({
  title,
  subtitle,
  icon,
  phase,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  phase: string;
  children?: ReactNode;
}) {
  return (
    <div className="bcn-stack">
      <PageHeader title={title} subtitle={subtitle} />
      {children}
      <Card>
        <EmptyState
          icon={icon}
          title={`Coming in ${phase}`}
          description={`This section is built in ${phase}.`}
        />
      </Card>
    </div>
  );
}
