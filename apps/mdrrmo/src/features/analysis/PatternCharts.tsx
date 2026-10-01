import { useState } from 'react';
import { Link } from 'react-router';
import type { IncidentAnalysis, PatternAnalysis } from '@beacon/shared';
import { Button, Card, HazardIcon, SelectField, Skeleton } from '@beacon/ui';
import { HighlightTable } from './viz/HighlightTable';
import { HotspotMap } from './viz/HotspotMap';
import { TrendChart, monthLabel, type TrendSeries } from './viz/TrendChart';
import { TableScroll } from '../TableScroll';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DIRECTION_TEXT = {
  increasing: 'rose over the period',
  decreasing: 'fell over the period',
  no_clear_trend: 'no clear trend',
  insufficient_data: 'too little data to test',
} as const;

function period(first: string, last: string): string {
  const a = monthLabel(first.slice(0, 7), true);
  const b = monthLabel(last.slice(0, 7), true);
  return a === b ? a : `${a} – ${b}`;
}

/** 4.3 Pattern Visualization: hotspot map, heatmaps and trend chart. */
export function PatternCharts({
  data,
  incidents,
}: {
  data: PatternAnalysis;
  incidents: IncidentAnalysis | null;
}) {
  return (
    <>
      <HotspotSection data={data} />
      <Card aria-labelledby="heat-barangay-heading">
        <h3 id="heat-barangay-heading" className="bcn-card__title">
          Hazard types by barangay
        </h3>
        <p className="m-card-hint">
          Records of each hazard type in each barangay; darker cells have more records. Outlined
          cells met the recurring-location rule (at least {data.parameters.recurrence_min_records}{' '}
          records in two or more months).
        </p>
        {incidents ? (
          <HighlightTable
            caption="Records by barangay and hazard type"
            cornerLabel="Barangay"
            rows={incidents.by_barangay.map((b) => ({ key: String(b.id), label: b.name }))}
            cols={incidents.by_hazard.map((h) => ({
              key: h.code,
              label: h.name,
              icon: <HazardIcon code={h.code} size={20} />,
            }))}
            value={(() => {
              const counts = new Map(
                incidents.hazard_by_barangay.map((c) => [`${c.barangay_id}|${c.hazard}`, c.count]),
              );
              return (row: string, col: string) => counts.get(`${row}|${col}`) ?? 0;
            })()}
            marked={(() => {
              const recurring = new Set(
                data.recurring_locations.map((r) => `${r.barangay_id}|${r.hazard.code}`),
              );
              return (row: string, col: string) => recurring.has(`${row}|${col}`);
            })()}
            markLabel="recurring location"
            markDescription="Recurring location"
          />
        ) : (
          <Skeleton height={200} />
        )}
      </Card>
      <Card aria-labelledby="heat-season-heading">
        <h3 id="heat-season-heading" className="bcn-card__title">
          Seasonal pattern by hazard type
        </h3>
        <p className="m-card-hint">
          Records in each month of the year, all years combined. Outlined cells are peak months
          found by the seasonality test.
        </p>
        <HighlightTable
          caption="Records by hazard type and month of the year"
          cornerLabel="Hazard"
          rows={data.seasonality.map((s) => ({
            key: s.hazard.code,
            label: s.hazard.name,
            icon: <HazardIcon code={s.hazard.code} size={20} />,
          }))}
          cols={MONTHS.map((m, i) => ({ key: String(i + 1), label: m }))}
          value={(row, col) =>
            data.seasonality.find((s) => s.hazard.code === row)?.monthly[Number(col) - 1] ?? 0
          }
          marked={(row, col) =>
            data.seasonality
              .find((s) => s.hazard.code === row)
              ?.peak_months.includes(Number(col)) ?? false
          }
          markLabel="peak month"
          markDescription="Peak month"
        />
      </Card>
      <TrendSection data={data} />
    </>
  );
}

function HotspotSection({ data }: { data: PatternAnalysis }) {
  const [selected, setSelected] = useState<string | null>(null);
  const spot = data.hotspots.find((h) => h.id === selected) ?? null;
  return (
    <Card aria-labelledby="hotspot-map-heading">
      <h3 id="hotspot-map-heading" className="bcn-card__title">
        Hotspot map
      </h3>
      <p className="m-card-hint">
        Each circle is centred on a hotspot and reaches its farthest record. Circles show where
        records clustered, not hazard zones or areas at risk.
      </p>
      {data.hotspots.length === 0 ? (
        <p className="bcn-muted">No hotspots met the method settings.</p>
      ) : (
        <div className="m-hotspot-layout">
          <HotspotMap hotspots={data.hotspots} selected={selected} onSelect={setSelected} />
          <div className="bcn-stack" style={{ gap: 'var(--bcn-space-3)' }}>
            <ul className="m-hotspot-list" aria-label="Hotspots">
              {data.hotspots.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="m-hotspot-list__item"
                    aria-pressed={h.id === selected}
                    onClick={() => setSelected(h.id === selected ? null : h.id)}
                  >
                    <HazardIcon code={h.hazard.code} size={28} />
                    <span>
                      <strong>
                        {h.id} · {h.hazard.name}
                      </strong>
                      <span className="m-cell-note">
                        {h.count} records · {h.barangays.slice(0, 2).join(', ')}
                        {h.barangays.length > 2 ? ' …' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {spot && (
              <div className="m-hotspot-detail" aria-live="polite">
                <strong>
                  {spot.id}: {spot.count} {spot.hazard.name.toLowerCase()} records
                </strong>
                <dl className="m-detail-list">
                  <dt>Barangays</dt>
                  <dd>{spot.barangays.join(', ')}</dd>
                  <dt>Period</dt>
                  <dd>{period(spot.first, spot.last)}</dd>
                  <dt>Radius</dt>
                  <dd>{spot.radius_m.toLocaleString('en-PH')} m</dd>
                </dl>
                <details className="m-ref-list">
                  <summary>Records in {spot.id}</summary>
                  <ul>
                    {spot.reference_nos.map((ref) => (
                      <li key={ref}>
                        <Link to={`/reports/${ref}`}>{ref}</Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function TrendSection({ data }: { data: PatternAnalysis }) {
  const [hazard, setHazard] = useState('');
  const [showTable, setShowTable] = useState(false);
  const overall = data.trends.find((t) => t.hazard === null)!;
  const chosen = data.trends.find((t) => t.hazard?.code === hazard) ?? null;
  const focus = chosen ?? overall;
  const series: TrendSeries[] = chosen
    ? [
        { key: 'all', label: 'All hazard types', counts: overall.counts, role: 'context' },
        {
          key: chosen.hazard!.code,
          label: chosen.hazard!.name,
          counts: chosen.counts,
          role: 'accent',
        },
      ]
    : [{ key: 'all', label: 'All hazard types', counts: overall.counts, role: 'accent' }];
  const fit =
    focus.fit_start !== null && focus.fit_end !== null
      ? { start: focus.fit_start, end: focus.fit_end, label: "Sen's slope (fitted line)" }
      : null;
  const name = chosen ? chosen.hazard!.name : 'All hazard types';

  return (
    <Card aria-labelledby="trend-chart-heading">
      <h3 id="trend-chart-heading" className="bcn-card__title">
        Records per month
      </h3>
      <div className="m-trend-controls">
        <SelectField label="Hazard type" value={hazard} onChange={(e) => setHazard(e.target.value)}>
          <option value="">All hazard types</option>
          {data.trends
            .filter((t) => t.hazard !== null)
            .map((t) => (
              <option key={t.hazard!.code} value={t.hazard!.code}>
                {t.hazard!.name}
              </option>
            ))}
        </SelectField>
        <p className="m-card-hint" style={{ margin: 0 }}>
          {name}: {DIRECTION_TEXT[focus.direction]}
          {focus.p_value !== null
            ? ` (Mann-Kendall p ${focus.p_value < 0.001 ? '< 0.001' : `= ${focus.p_value.toFixed(3)}`})`
            : ''}
          . The fitted line covers the recorded months only.
        </p>
      </div>
      <TrendChart
        months={data.trend_months}
        series={series}
        fit={fit}
        caption={`Records per month, ${name}`}
      />
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={showTable}
        onClick={() => setShowTable((v) => !v)}
      >
        {showTable ? 'Hide data table' : 'Show data table'}
      </Button>
      {showTable && (
        <TableScroll label={`Records per month, ${name}`}>
          <table className="m-table m-table--compact">
            <caption className="bcn-visually-hidden">Records per month, {name}</caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="m-num">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.trend_months.map((month, i) => (
                <tr key={month}>
                  <th scope="row">
                    {MONTH_NAMES[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} className="m-num">
                      {s.counts[i]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Card>
  );
}
