import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bcn-empty">
      <div className="bcn-empty__icon" aria-hidden="true">
        {icon}
      </div>
      <h2 className="bcn-empty__title">{title}</h2>
      {description && <p className="bcn-empty__description">{description}</p>}
      {action}
    </div>
  );
}
