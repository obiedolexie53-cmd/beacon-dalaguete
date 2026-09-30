import { cx } from '../cx';

/** BEACON mark: a signal light radiating from a tower. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="#0b2545" />
      <path
        d="M17 24a18 18 0 0 1 30 0M22 28a11 11 0 0 1 20 0"
        fill="none"
        stroke="#f2a900"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="32" cy="32" r="5" fill="#f2a900" />
      <path d="M28 38h8l3 16H25z" fill="#ffffff" />
    </svg>
  );
}

export function Logo({
  size = 40,
  inverse = false,
  showWordmark = true,
}: {
  size?: number;
  inverse?: boolean;
  showWordmark?: boolean;
}) {
  return (
    <span className={cx('bcn-logo', inverse && 'bcn-logo--inverse')}>
      <LogoMark size={size} />
      {showWordmark ? (
        <span style={{ fontSize: size * 0.5 }}>BEACON</span>
      ) : (
        <span className="bcn-visually-hidden">BEACON</span>
      )}
    </span>
  );
}
