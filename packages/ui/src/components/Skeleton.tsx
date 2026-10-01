/** Grey placeholder shown while content loads. Hidden from assistive technology. */
export function Skeleton({
  width = '100%',
  height = 16,
}: {
  width?: number | string;
  height?: number;
}) {
  return <span className="bcn-skeleton" style={{ width, height }} aria-hidden="true" />;
}
