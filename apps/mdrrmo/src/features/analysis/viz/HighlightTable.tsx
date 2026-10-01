import type { ReactNode } from 'react';
import { HEAT_STEPS, heatLegend, heatStep } from './scale';
import { TableScroll } from '../../TableScroll';

export interface HeatAxis {
  key: string;
  label: string;
  /** Optional visual beside the label (e.g. a hazard icon). */
  icon?: ReactNode;
}

/**
 * A heatmap drawn as a real table: every cell shows its count as text and is
 * shaded on one sequential blue ramp (more = darker). Because it is a table, it is
 * also its own accessible table view. Marked cells (e.g. recurring locations or
 * peak months) get an outline plus hidden text, never colour alone.
 */
export function HighlightTable({
  caption,
  cornerLabel,
  rows,
  cols,
  value,
  marked,
  markLabel,
  markDescription,
}: {
  caption: string;
  cornerLabel: string;
  rows: HeatAxis[];
  cols: HeatAxis[];
  value: (row: string, col: string) => number;
  marked?: (row: string, col: string) => boolean;
  /** Screen-reader suffix for marked cells, e.g. "recurring location". */
  markLabel?: string;
  /** Legend text for the outline, e.g. "Recurring location (4.2)". */
  markDescription?: string;
}) {
  const grid = rows.map((r) => cols.map((c) => value(r.key, c.key)));
  const max = Math.max(0, ...grid.flat());
  const rowTotals = grid.map((cells) => cells.reduce((a, b) => a + b, 0));
  const colTotals = cols.map((_, j) => grid.reduce((a, cells) => a + cells[j]!, 0));

  return (
    <div className="bcn-stack" style={{ gap: 'var(--bcn-space-3)' }}>
      <HeatLegend max={max} markDescription={markDescription} />
      <TableScroll label={caption}>
        <table className="m-heat">
          <caption className="bcn-visually-hidden">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="m-heat__corner">
                {cornerLabel}
              </th>
              {cols.map((c) => (
                <th key={c.key} scope="col" className="m-heat__col">
                  <span className="m-heat__col-label">
                    {c.icon}
                    {c.label}
                  </span>
                </th>
              ))}
              <th scope="col" className="m-heat__total">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key}>
                <th scope="row" className="m-heat__row">
                  <span className="m-heat__col-label">
                    {r.icon}
                    {r.label}
                  </span>
                </th>
                {cols.map((c, j) => {
                  const count = grid[i]![j]!;
                  const step = heatStep(count, max);
                  const isMarked = marked?.(r.key, c.key) ?? false;
                  const fill = step === null ? null : HEAT_STEPS[step]!;
                  return (
                    <td
                      key={c.key}
                      className="m-heat__cell"
                      data-ink={fill?.ink}
                      data-marked={isMarked || undefined}
                      style={fill ? { background: fill.fill } : undefined}
                      title={`${r.label} · ${c.label}: ${count}`}
                    >
                      {count > 0 ? count : <span className="bcn-visually-hidden">0</span>}
                      {isMarked && markLabel && (
                        <span className="bcn-visually-hidden">, {markLabel}</span>
                      )}
                    </td>
                  );
                })}
                <td className="m-heat__total">{rowTotals[i]}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="m-heat__row">
                Total
              </th>
              {colTotals.map((total, j) => (
                <td key={cols[j]!.key} className="m-heat__total">
                  {total}
                </td>
              ))}
              <td className="m-heat__total">{rowTotals.reduce((a, b) => a + b, 0)}</td>
            </tr>
          </tfoot>
        </table>
      </TableScroll>
    </div>
  );
}

function HeatLegend({ max, markDescription }: { max: number; markDescription?: string }) {
  const bins = heatLegend(max);
  return (
    <div className="m-heat-legend" aria-hidden="true">
      <span className="m-heat-legend__title">Records</span>
      <span className="m-heat-legend__swatch m-heat-legend__swatch--empty" />
      <span>0</span>
      {bins.map((bin) => (
        <span key={bin.index} className="m-heat-legend__item">
          <span
            className="m-heat-legend__swatch"
            style={{ background: HEAT_STEPS[bin.index]!.fill }}
          />
          {bin.from === bin.to ? bin.from : `${bin.from}–${bin.to}`}
        </span>
      ))}
      {markDescription && (
        <span className="m-heat-legend__item">
          <span className="m-heat-legend__swatch m-heat-legend__swatch--marked" />
          {markDescription}
        </span>
      )}
    </div>
  );
}
