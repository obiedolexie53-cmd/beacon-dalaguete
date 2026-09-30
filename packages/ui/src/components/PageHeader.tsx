import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, onBack, actions }: PageHeaderProps) {
  return (
    <header className="bcn-page-header">
      {onBack && (
        <button type="button" className="bcn-icon-button" onClick={onBack} aria-label="Go back">
          <ArrowLeft size={24} aria-hidden="true" />
        </button>
      )}
      <div className="bcn-page-header__text">
        {/* tabIndex -1 lets screens move focus here after navigation. */}
        <h1 className="bcn-page-header__title" tabIndex={-1}>
          {title}
        </h1>
        {subtitle && <p className="bcn-page-header__subtitle">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
