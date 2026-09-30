import type { ReactNode } from 'react';

export interface Column {
  key: string;
  /** Short label under the bar (e.g. "Sep"). */
  label: string;
  /** Full label for the data table and tooltip (e.g. "September 2025"). */
  fullLabel: string;
  value: number;
}

/**
 * Simple single-hue column chart. The bars are decorative for screen readers:
 * the same numbers follow in a visually hidden table.
 */
export function ColumnChart({
  columns,
  caption,
  labelEvery = 1,
  headerLabel,
}: {
  columns: Column[];
  /** Describes the chart, e.g. "Records per month". Used as the table caption. */
  caption: string;
  /** Show every nth label under the bars (all values stay in the table and tooltips). */
  labelEvery?: number;
  /** Heading for the label column of the hidden table, e.g. "Month". */
  headerLabel: string;
}) {
  const max = Math.max(1, ...columns.map((c) => c.value));
  const showValues = columns.length <= 24;
  return (
    <figure className="m-chart">
      <div className="m-chart__scroll">
        <div
          className="m-chart__plot"
          aria-hidden="true"
          style={{ minWidth: columns.length * (showValues ? 26 : 12) }}
        >
          {columns.map((column, index) => (
            <div
              key={column.key}
              className="m-chart__col"
              title={`${column.fullLabel}: ${column.value}`}
            >
              {showValues && <span className="m-chart__value">{column.value}</span>}
              <span
                className="m-chart__bar"
                style={{ height: `${(column.value / max) * 100}%` }}
                data-zero={column.value === 0 || undefined}
              />
              <span className="m-chart__label">{index % labelEvery === 0 ? column.label : ''}</span>
            </div>
          ))}
        </div>
      </div>
      {/* A table ignores the 1px width of .bcn-visually-hidden, so hide a wrapper instead. */}
      <div className="bcn-visually-hidden">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{headerLabel}</th>
              <th scope="col">Records</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr key={column.key}>
                <th scope="row">{column.fullLabel}</th>
                <td>{column.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Horizontal bar showing a share of the dataset, next to the percentage. */
export function ShareBar({ share, max }: { share: number; max: number }) {
  return (
    <span className="m-share">
      <span className="m-share__track" aria-hidden="true">
        <span className="m-share__bar" style={{ width: `${max > 0 ? (share / max) * 100 : 0}%` }} />
      </span>
      <span className="m-share__value">{formatShare(share)}</span>
    </span>
  );
}

export function formatShare(share: number): string {
  const pct = share * 100;
  return pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`;
}

export function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="bcn-card m-stat">
      <span className="m-stat__label">{label}</span>
      <span className="m-stat__value">{value}</span>
      {note && <span className="m-cell-note">{note}</span>}
    </div>
  );
}
