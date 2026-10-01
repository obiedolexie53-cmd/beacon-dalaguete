import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'bcn-button',
        `bcn-button--${variant}`,
        size === 'sm' && 'bcn-button--sm',
        block && 'bcn-button--block',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner label="" /> : icon}
      {children}
    </button>
  );
}

/** Class names for rendering a router link (or <a>) that looks like a button. */
export function buttonClassName(
  variant: ButtonVariant = 'primary',
  options: { block?: boolean; size?: 'md' | 'sm' } = {},
): string {
  return cx(
    'bcn-button',
    `bcn-button--${variant}`,
    options.size === 'sm' && 'bcn-button--sm',
    options.block && 'bcn-button--block',
  );
}
