import type { ReactNode } from 'react';
import { cx } from '../cx';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'resolved' | 'demo';

export function Badge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={cx('bcn-badge', `bcn-badge--${tone}`)}>
      {icon}
      {children}
    </span>
  );
}

/** Marks fictional sample content so it is never mistaken for a real incident. */
export function DemoBadge({ children = 'DEMO DATA' }: { children?: ReactNode }) {
  return <Badge tone="demo">{children}</Badge>;
}
