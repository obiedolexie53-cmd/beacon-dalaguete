import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  flat?: boolean;
  as?: 'section' | 'div' | 'article';
}

export function Card({
  title,
  flat,
  as: Tag = 'section',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag className={cx('bcn-card', flat && 'bcn-card--flat', className)} {...rest}>
      {title && <h3 className="bcn-card__title">{title}</h3>}
      {children}
    </Tag>
  );
}
