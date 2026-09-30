import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarRange,
  ChartColumnBig,
  Link2,
  MapPin,
  Repeat,
} from 'lucide-react';
import { useApiQuery } from '@beacon/auth';
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  type PatternAnalysis,
  type PatternFindingKind,
  type TrendDirection,
} from '@beacon/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  HazardIcon,
  PageHeader,
  SelectField,
  Skeleton,
} from '@beacon/ui';
import { DemoToggle, useReportFilters, type ReportFilterState } from '../reports/ReportFilters';
import { HISTORY_FILTER_KEYS, HistoryFilterFields } from '../history/HistoryFilters';

export const ANALYSIS_DISCLAIMER =
  'This analysis identifies recurring patterns in recorded disaster reports. It does not ' +
  'predict future disasters and does not replace MDRRMO assessment or emergency decision-making.';

const SETTING_KEYS = [
  'hotspot_distance_m',
  'hotspot_min_records',
  'recurrence_min_records',
  'co_occurrence_days',
] as const;
const QUERY_KEYS = [...HISTORY_FILTER_KEYS, ...SETTING_KEYS];

/** Co-occurrence rows shown before "Show all". */
const PAIRS_SHOWN = 10;

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

const KIND_LABELS: Record<PatternFindingKind, { label: string; Icon: typeof Repeat }> = {
  recurrence: { label: 'Recurring location', Icon: Repeat },
  hotspot: { label: 'Hotspot', Icon: MapPin },
  seasonality: { label: 'Seasonal', Icon: CalendarRange },
  trend: { label: 'Trend', Icon: ChartColumnBig },
  co_occurrence: { label: 'Recorded together', Icon: Link2 },
};

export function AnalysisPage() {
  const filters = useReportFilters();
  const query = useApiQuery<PatternAnalysis>(
    `/staff/analysis/patterns?${filters.apiQuery(QUERY_KEYS)}`,
  );
  const data = query.data;

  return (
    <div className="bcn-stack">
      <PageHeader
        title="Hazard Pattern Analysis"
        subtitle="4.2 Hazard Pattern Identification: machine learning-assisted analysis of recorded reports."
      />
      <Alert tone="info" title="About this analysis">
        <span>{ANALYSIS_DISCLAIMER}</span> For counts by hazard, barangay and time, see{' '}
        <Link to="/history">Historical Reports</Link>.
      </Alert>

      <Card className="m-filters">
        <HistoryFilterFields filters={filters} />
        <MethodSettings filters={filters} />
        <div className="m-filters__footer">
          <DemoToggle filters={filters} />
          {filters.has(QUERY_KEYS) && (
            <Button variant="ghost" size="sm" onClick={() => filters.clear(QUERY_KEYS)}>
              Clear filters and settings
            </Button>
          )}
        </div>
      </Card>

      {query.error !== null ? (
        <Alert
          tone="danger"
          title="Could not run the analysis"
          action={
            <Button variant="secondary" size="sm" onClick={query.reload}>
              Try again
            </Button>
          }
        >
          {query.error instanceof ApiError && !query.error.isNetworkError
            ? query.error.message
            : NETWORK_ERROR_MESSAGE}
        </Alert>
      ) : !data ? (
        <Card aria-busy="true" aria-label="Running the analysis" className="bcn-stack">
          <Skeleton height={24} width="40%" />
          <Skeleton height={120} />
        </Card>
      ) : !data.dataset.sufficient ? (
        <Card>
          <EmptyState
            icon={<ChartColumnBig size={28} />}
            title="Not enough records to identify patterns"
            description={`At least 10 records are needed; ${data.dataset.total} match these filters. Try a longer period, fewer filters or "All recorded reports".`}
          />
        </Card>
      ) : (
        <PatternResults data={data} />
      )}
      <MethodsCard />
    </div>
  );
}

function MethodSettings({ filters }: { filters: ReportFilterState }) {
  const { params, update } = filters;
  const setting = (key: (typeof SETTING_KEYS)[number], fallback: string) =>
    params.get(key) ?? fallback;
  return (
    <details className="m-settings">
      <summary>Method settings</summary>
      <div className="m-filters__grid">
        <SelectField
          label="Hotspot distance"
          hint="How close records must be to form a hotspot"
          value={setting('hotspot_distance_m', '500')}
          onChange={(e) => update({ hotspot_distance_m: e.target.value })}
        >
          {[250, 500, 1000, 2000].map((m) => (
            <option key={m} value={m}>
              {m >= 1000 ? `${m / 1000} km` : `${m} m`}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Records per hotspot"
          hint="Fewest records that make a hotspot"
          value={setting('hotspot_min_records', '3')}
          onChange={(e) => update({ hotspot_min_records: e.target.value })}
        >
          {[3, 5, 10].map((n) => (
            <option key={n} value={n}>
              At least {n}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Records for a recurring location"
          hint="Of one hazard type in one barangay"
          value={setting('recurrence_min_records', '3')}
          onChange={(e) => update({ recurrence_min_records: e.target.value })}
        >
          {[3, 5, 10].map((n) => (
            <option key={n} value={n}>
              At least {n}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Recorded together"
          hint="Days apart for records to count as together"
          value={setting('co_occurrence_days', '2')}
          onChange={(e) => update({ co_occurrence_days: e.target.value })}
        >
          {[0, 1, 2, 3, 7].map((n) => (
            <option key={n} value={n}>
              {n === 0 ? 'Same day' : `Within ${n} day${n === 1 ? '' : 's'}`}
            </option>
          ))}
        </SelectField>
      </div>
    </details>
  );
}

function monthYear(iso: string): string {
  const [year, month] = iso.split('-').map(Number);
  return `${MONTHS[month! - 1]} ${year}`;
}

function period(first: string, last: string): string {
  const a = monthYear(first);
  const b = monthYear(last);
  return a === b ? a : `${a} – ${b}`;
}

function pValue(p: number | null): string {
  if (p === null) return '—';
  return p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function Section({
  id,
  title,
  intro,
  empty,
  children,
}: {
  id: string;
  title: string;
  intro: ReactNode;
  empty: string | null;
  children: ReactNode;
}) {
  return (
    <Card aria-labelledby={id}>
      <h3 id={id} className="bcn-card__title">
        {title}
      </h3>
      <p className="m-card-hint">{intro}</p>
      {empty ? <p className="bcn-muted">{empty}</p> : children}
    </Card>
  );
}

function PatternResults({ data }: { data: PatternAnalysis }) {
  const { parameters: settings, dataset } = data;
  const days = settings.co_occurrence_days;
  const [allPairs, setAllPairs] = useState(false);
  const pairs = allPairs ? data.co_occurrence : data.co_occurrence.slice(0, PAIRS_SHOWN);
  return (
    <>
      <Card title="Key findings">
        <p className="m-card-hint">
          From {dataset.total.toLocaleString('en-PH')} records
          {dataset.first_incident && dataset.last_incident
            ? `, ${period(dataset.first_incident, dataset.last_incident)}`
            : ''}
          . {dataset.with_coordinates.toLocaleString('en-PH')} have a map pin and are used for
          hotspots.
        </p>
        {data.findings.length === 0 ? (
          <p className="bcn-muted">No patterns met the thresholds in the method settings.</p>
        ) : (
          <ul className="m-pattern-findings">
            {data.findings.map((finding, index) => {
              const { label, Icon } = KIND_LABELS[finding.kind];
              return (
                <li key={index}>
                  <span className="m-pattern-findings__icon" aria-hidden="true">
                    {finding.hazard ? (
                      <HazardIcon code={finding.hazard} size={32} />
                    ) : (
                      <Icon size={20} />
                    )}
                  </span>
                  <span>
                    <Badge tone="info" icon={<Icon size={12} aria-hidden="true" />}>
                      {label}
                    </Badge>{' '}
                    {finding.text}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Section
        id="recurring-heading"
        title="Recurring hazard locations"
        intro={`Hazard types recorded at least ${settings.recurrence_min_records} times, in at least two different months, in the same barangay. Ranked by number of records.`}
        empty={
          data.recurring_locations.length === 0 ? 'No recurring locations met the settings.' : null
        }
      >
        <div className="m-table-wrap">
          <table className="m-table m-table--compact">
            <caption className="bcn-visually-hidden">Recurring hazard locations</caption>
            <thead>
              <tr>
                <th scope="col">Hazard</th>
                <th scope="col">Barangay</th>
                <th scope="col" className="m-num">
                  Records
                </th>
                <th scope="col" className="m-num">
                  Months with records
                </th>
                <th scope="col">Period</th>
                <th scope="col" className="m-num">
                  Share of this hazard
                </th>
              </tr>
            </thead>
            <tbody>
              {data.recurring_locations.map((r) => (
                <tr key={`${r.hazard.code}-${r.barangay_id}`}>
                  <td>
                    <span className="m-hazard-cell">
                      <HazardIcon code={r.hazard.code} size={28} />
                      {r.hazard.name}
                    </span>
                  </td>
                  <td>{r.barangay}</td>
                  <td className="m-num">{r.count}</td>
                  <td className="m-num">{r.months_with_records}</td>
                  <td>{period(r.first, r.last)}</td>
                  <td className="m-num">{percent(r.share_of_hazard)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="hotspot-heading"
        title="Hotspots"
        intro={`Groups of at least ${settings.hotspot_min_records} records of the same hazard type within ${settings.hotspot_distance_m.toLocaleString('en-PH')} m of each other (DBSCAN clustering on map pins). Records without a map pin are not included.`}
        empty={data.hotspots.length === 0 ? 'No hotspots met the settings.' : null}
      >
        <div className="m-table-wrap">
          <table className="m-table m-table--compact">
            <caption className="bcn-visually-hidden">Hotspots</caption>
            <thead>
              <tr>
                <th scope="col">Hotspot</th>
                <th scope="col">Hazard</th>
                <th scope="col" className="m-num">
                  Records
                </th>
                <th scope="col">Barangays</th>
                <th scope="col" className="m-num">
                  Radius
                </th>
                <th scope="col">Period</th>
                <th scope="col">Records in this hotspot</th>
              </tr>
            </thead>
            <tbody>
              {data.hotspots.map((h) => (
                <tr key={h.id}>
                  <th scope="row">{h.id}</th>
                  <td>
                    <span className="m-hazard-cell">
                      <HazardIcon code={h.hazard.code} size={28} />
                      {h.hazard.name}
                    </span>
                  </td>
                  <td className="m-num">{h.count}</td>
                  <td>{h.barangays.join(', ') || '—'}</td>
                  <td className="m-num">{h.radius_m.toLocaleString('en-PH')} m</td>
                  <td>{period(h.first, h.last)}</td>
                  <td>
                    <details className="m-ref-list">
                      <summary>
                        {h.count} records
                        <span className="bcn-visually-hidden"> in hotspot {h.id}</span>
                      </summary>
                      <ul>
                        {h.reference_nos.map((ref) => (
                          <li key={ref}>
                            <Link to={`/reports/${ref}`}>{ref}</Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="season-heading"
        title="Seasonal patterns"
        intro="Records per month of the year for each hazard type, compared with an even spread (chi-square test, allowing for how often each month occurs in the period). Highlighted months had clearly more records."
        empty={data.seasonality.length === 0 ? 'No records.' : null}
      >
        <div className="m-table-wrap">
          <table className="m-table m-table--compact">
            <caption className="bcn-visually-hidden">Seasonal patterns</caption>
            <thead>
              <tr>
                <th scope="col">Hazard</th>
                <th scope="col" className="m-num">
                  Records
                </th>
                <th scope="col">Records by month (Jan–Dec)</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {data.seasonality.map((s) => (
                <tr key={s.hazard.code}>
                  <td>
                    <span className="m-hazard-cell">
                      <HazardIcon code={s.hazard.code} size={28} />
                      {s.hazard.name}
                    </span>
                  </td>
                  <td className="m-num">{s.total}</td>
                  <td>
                    <MonthProfile monthly={s.monthly} peaks={s.peak_months} />
                  </td>
                  <td>
                    {s.p_value === null
                      ? 'Too few records to test'
                      : s.concentrated && s.peak_months.length > 0
                        ? `Concentrated in ${s.peak_months.map((m) => MONTH_NAMES[m - 1]).join(', ')}`
                        : s.concentrated
                          ? 'Uneven, with no single peak month'
                          : 'No clear concentration'}
                    <span className="m-cell-note">{pValue(s.p_value)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="trend-heading"
        title="Trends over time"
        intro="Whether the number of records per month rose or fell over the period (Mann-Kendall test; change per year from Sen's slope). A change can also come from changes in how incidents were reported. At least 12 months and 10 records are needed."
        empty={null}
      >
        <div className="m-table-wrap">
          <table className="m-table m-table--compact">
            <caption className="bcn-visually-hidden">Trends over time</caption>
            <thead>
              <tr>
                <th scope="col">Hazard</th>
                <th scope="col" className="m-num">
                  Records
                </th>
                <th scope="col">Recorded counts</th>
                <th scope="col" className="m-num">
                  Change per year
                </th>
                <th scope="col" className="m-num">
                  Test
                </th>
              </tr>
            </thead>
            <tbody>
              {data.trends.map((t) => (
                <tr key={t.hazard?.code ?? 'all'}>
                  <td>
                    {t.hazard ? (
                      <span className="m-hazard-cell">
                        <HazardIcon code={t.hazard.code} size={28} />
                        {t.hazard.name}
                      </span>
                    ) : (
                      <strong>All hazard types</strong>
                    )}
                  </td>
                  <td className="m-num">{t.total}</td>
                  <td>
                    <TrendLabel direction={t.direction} />
                  </td>
                  <td className="m-num">
                    {t.change_per_year === null
                      ? '—'
                      : `${t.change_per_year > 0 ? '+' : ''}${t.change_per_year}`}
                  </td>
                  <td className="m-num">{pValue(t.p_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="co-heading"
        title="Hazards recorded together"
        intro={`How often a record of one hazard type had a record of another type anywhere in Dalaguete ${days === 0 ? 'on the same day' : `within ${days} day${days === 1 ? '' : 's'}`}. "Times as often" compares with the other type's records in the same month spread evenly, so two hazards that only share a season score about 1.`}
        empty={
          data.co_occurrence.length === 0
            ? 'No hazard types were recorded together at least 3 times.'
            : null
        }
      >
        <div className="m-table-wrap">
          <table className="m-table m-table--compact">
            <caption className="bcn-visually-hidden">Hazards recorded together</caption>
            <thead>
              <tr>
                <th scope="col">Records of</th>
                <th scope="col">With a record of</th>
                <th scope="col" className="m-num">
                  Records
                </th>
                <th scope="col" className="m-num">
                  Share
                </th>
                <th scope="col" className="m-num">
                  Times as often
                </th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((c) => (
                <tr key={`${c.hazard.code}-${c.with_hazard.code}`}>
                  <td>{c.hazard.name}</td>
                  <td>{c.with_hazard.name}</td>
                  <td className="m-num">{c.count}</td>
                  <td className="m-num">{percent(c.share)}</td>
                  <td className="m-num">{c.lift === null ? '—' : `${c.lift}×`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.co_occurrence.length > PAIRS_SHOWN && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={allPairs}
            onClick={() => setAllPairs((v) => !v)}
          >
            {allPairs ? 'Show fewer' : `Show all ${data.co_occurrence.length} pairs`}
          </Button>
        )}
      </Section>
    </>
  );
}

function TrendLabel({ direction }: { direction: TrendDirection }) {
  switch (direction) {
    case 'increasing':
      return (
        <span className="m-trend">
          <ArrowUpRight size={16} aria-hidden="true" /> Rose
        </span>
      );
    case 'decreasing':
      return (
        <span className="m-trend">
          <ArrowDownRight size={16} aria-hidden="true" /> Fell
        </span>
      );
    case 'no_clear_trend':
      return (
        <span className="m-trend">
          <ArrowRight size={16} aria-hidden="true" /> No clear trend
        </span>
      );
    default:
      return <span className="bcn-muted">Too little data</span>;
  }
}

/** Twelve small bars (January to December); peak months are darker. */
function MonthProfile({ monthly, peaks }: { monthly: number[]; peaks: number[] }) {
  const max = Math.max(1, ...monthly);
  return (
    <span className="m-month-profile">
      <span className="m-month-profile__bars" aria-hidden="true">
        {monthly.map((count, i) => (
          <span
            key={i}
            className="m-month-profile__bar"
            data-peak={peaks.includes(i + 1) || undefined}
            style={{ height: `${Math.max(count > 0 ? 8 : 0, (count / max) * 100)}%` }}
            title={`${MONTH_NAMES[i]}: ${count}`}
          />
        ))}
      </span>
      <span className="bcn-visually-hidden">
        {monthly.map((count, i) => `${MONTHS[i]} ${count}`).join(', ')}
      </span>
    </span>
  );
}

function MethodsCard() {
  return (
    <Card title="How the patterns are identified">
      <dl className="m-methods">
        <dt>Recurring hazard locations</dt>
        <dd>
          Records are grouped by hazard type and barangay. A group counts as recurring when it has
          at least the set number of records spread over at least two different months.
        </dd>
        <dt>Hotspots (DBSCAN)</dt>
        <dd>
          Density-based clustering (DBSCAN, scikit-learn) on map pins, using distance along the
          Earth's surface, run separately for each hazard type. A hotspot is a group of records that
          each have enough other records nearby. Isolated records are left out.
        </dd>
        <dt>Seasonal patterns (chi-square test)</dt>
        <dd>
          Records per month of the year are compared with an even spread, allowing for how often
          each month occurs in the period. When the difference is statistically significant (p &lt;
          0.05), months with clearly more records (standardised residual of 2 or more) are named.
        </dd>
        <dt>Trends (Mann-Kendall test, Sen's slope)</dt>
        <dd>
          Tests whether monthly counts consistently rose or fell over the period (p &lt; 0.05). The
          change per year is the median of the slopes between every pair of months.
        </dd>
        <dt>Hazards recorded together</dt>
        <dd>
          Counts records of one hazard type that had a record of another type within the set number
          of days anywhere in the municipality.
        </dd>
        <dt>Limits</dt>
        <dd>
          All results describe what was reported and recorded. Gaps in record-keeping, the start of
          app reporting, map pins placed from memory, and small numbers of records all affect them.
          They identify patterns for MDRRMO personnel to examine. They are not predictions and are
          not risk or hazard maps.
        </dd>
      </dl>
    </Card>
  );
}
