import type { StatusCounts } from '@beacon/shared';
import { CircleCheckBig, FileText, Hourglass, ShieldCheck, type LucideIcon } from 'lucide-react';

interface Tile {
  key: string;
  label: string;
  Icon: LucideIcon;
  value: (counts: StatusCounts) => number;
}

/** "In review" groups everything the MDRRMO has not yet verified. */
const TILES: Tile[] = [
  { key: 'total', label: 'Total reports', Icon: FileText, value: (c) => c.total },
  {
    key: 'review',
    label: 'In review',
    Icon: Hourglass,
    value: (c) => c.submitted + c.under_verification + c.needs_clarification,
  },
  { key: 'verified', label: 'Verified', Icon: ShieldCheck, value: (c) => c.verified },
  { key: 'resolved', label: 'Resolved', Icon: CircleCheckBig, value: (c) => c.resolved },
];

export function StatusSummary({ counts }: { counts: StatusCounts | null }) {
  return (
    <dl className="r-stats" aria-busy={counts === null}>
      {TILES.map(({ key, label, Icon, value }) => (
        <div key={key} className="r-stat">
          <dt>
            <Icon size={16} aria-hidden="true" />
            {label}
          </dt>
          <dd>
            {counts ? (
              value(counts)
            ) : (
              <span className="bcn-skeleton" style={{ width: 32, height: 28 }} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
