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

/**
 * Inline message. Errors (danger) are announced to screen readers immediately.
 * Other tones use the polite status role, so static notices such as safety
 * reminders are not read out urgently on every page load.
 */
export function Alert({ tone = 'info', title, children, action }: AlertProps) {
  const Icon = ICONS[tone];
  return (
    <div className={`bcn-alert bcn-alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon className="bcn-alert__icon" size={20} aria-hidden="true" />
      <div className="bcn-alert__body">
        {title && <div className="bcn-alert__title">{title}</div>}
        {children}
        {action && <div style={{ marginTop: 'var(--bcn-space-3)' }}>{action}</div>}
      </div>
    </div>
  );
}
