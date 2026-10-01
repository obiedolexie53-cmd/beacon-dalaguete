export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className="bcn-spinner-wrap">
      <span className="bcn-spinner" aria-hidden="true" />
      {label && <span className="bcn-visually-hidden">{label}</span>}
    </span>
  );
}
