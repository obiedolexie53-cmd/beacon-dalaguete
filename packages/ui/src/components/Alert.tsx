import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const ICONS: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}

/** Inline message. Danger and warning alerts are announced to screen readers immediately. */
export function Alert({ tone = 'info', title, children, action }: AlertProps) {
  const Icon = ICONS[tone];
  const urgent = tone === 'danger' || tone === 'warning';
  return (
    <div className={`bcn-alert bcn-alert--${tone}`} role={urgent ? 'alert' : 'status'}>
      <Icon className="bcn-alert__icon" size={20} aria-hidden="true" />
      <div className="bcn-alert__body">
        {title && <div className="bcn-alert__title">{title}</div>}
        {children}
        {action && <div style={{ marginTop: 'var(--bcn-space-3)' }}>{action}</div>}
      </div>
    </div>
  );
}
