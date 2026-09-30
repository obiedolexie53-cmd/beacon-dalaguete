import { useState } from 'react';
import { Download, History, Info } from 'lucide-react';
import { useApiClient, useApiQuery } from '@beacon/auth';
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  type Barangay,
  type HazardType,
  type IncidentAnalysis,
} from '@beacon/shared';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  HazardIcon,
  PageHeader,
  SelectField,
  Skeleton,
  TextField,
} from '@beacon/ui';
import { ANALYSIS_DISCLAIMER } from '../analysis/AnalysisPage';
import { DemoToggle, useReportFilters, type ReportFilterState } from '../reports/ReportFilters';
import { ColumnChart, ShareBar, StatTile, formatShare, type Column } from './charts';
import { PERIODS, matchPeriod, periodRange } from './periods';

export const HISTORY_FILTER_KEYS = [
  'scope',
  'hazard',
  'barangay_id',
  'source',
  'date_from',
  'date_to',
] as const;

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
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const BARANGAYS_SHOWN = 10;

export function HistoryPage() {
  const filters = useReportFilters();
  const query = filters.apiQuery(HISTORY_FILTER_KEYS);
  const analysis = useApiQuery<IncidentAnalysis>(`/staff/analysis/incidents?${query}`);
  const data = analysis.data;

  return (
    <div className="bcn-stack">
      <PageHeader
        title="Historical Reports"
        subtitle="4.1 Incident Data Analysis: what was recorded, where and when."
        actions={<ExportButton query={query} disabled={!data || data.dataset.total === 0} />}
      />
      <Alert tone="info" title="Recorded data only">
        These figures describe the recorded reports that match the filters. They do not predict
        future incidents or replace MDRRMO assessment.
      </Alert>

      <Card className="m-filters">
        <HistoryFilterFields filters={filters} />
        <div className="m-filters__footer">
          <DemoToggle filters={filters} />
          {filters.has(HISTORY_FILTER_KEYS) && (
            <Button variant="ghost" size="sm" onClick={() => filters.clear(HISTORY_FILTER_KEYS)}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {analysis.error !== null ? (
        <Alert
          tone="danger"
          title="Could not load the analysis"
          action={
            <Button variant="secondary" size="sm" onClick={analysis.reload}>
              Try again
            </Button>
          }
        >
          {analysis.error instanceof ApiError && !analysis.error.isNetworkError
            ? analysis.error.message
            : NETWORK_ERROR_MESSAGE}
        </Alert>
      ) : !data ? (
        <div className="m-stats" aria-busy="true" aria-label="Loading the analysis">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton height={56} />
            </Card>
          ))}
        </div>
      ) : data.dataset.total === 0 ? (
        <Card>
          <EmptyState
            icon={<History size={28} />}
            title="No records match these filters"
            description={
              data.filters.scope === 'confirmed'
                ? 'Only reports verified or resolved by MDRRMO are counted. Try "All recorded reports" or a longer period.'
                : 'Try a longer period or fewer filters.'
            }
          />
        </Card>
      ) : (
        <AnalysisResults data={data} />
      )}
    </div>
  );
}

function HistoryFilterFields({ filters }: { filters: ReportFilterState }) {
  const hazards = useApiQuery<HazardType[]>('/hazard-types');
  const barangays = useApiQuery<Barangay[]>('/barangays');
  const { params, update } = filters;
  const period = matchPeriod(params.get('date_from'), params.get('date_to'));

  return (
    <div className="m-filters__grid">
      <SelectField
        label="Period"
        value={period}
        onChange={(e) => {
          const range = periodRange(e.target.value);
          if (range) update({ date_from: range.from, date_to: range.to });
        }}
      >
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
        {period === 'custom' && <option value="custom">Custom dates</option>}
      </SelectField>
      <TextField
        label="Incident from"
        type="date"
        value={params.get('date_from') ?? ''}
        onChange={(e) => update({ date_from: e.target.value })}
      />
      <TextField
        label="Incident to"
        type="date"
        value={params.get('date_to') ?? ''}
        onChange={(e) => update({ date_to: e.target.value })}
      />
      <SelectField
        label="Records"
        value={params.get('scope') ?? ''}
        onChange={(e) => update({ scope: e.target.value })}
      >
        <option value="">Confirmed by MDRRMO (verified or resolved)</option>
        <option value="all">All recorded reports, including unverified</option>
      </SelectField>
      <SelectField
        label="Source"
        value={params.get('source') ?? ''}
        onChange={(e) => update({ source: e.target.value })}
      >
        <option value="">All sources</option>
        <option value="resident">Submitted in the resident app</option>
        <option value="import">Imported MDRRMO records</option>
      </SelectField>
      <SelectField
        label="Hazard"
        value={params.get('hazard') ?? ''}
        onChange={(e) => update({ hazard: e.target.value })}
      >
        <option value="">All hazards</option>
        {hazards.data?.map((h) => (
          <option key={h.code} value={h.code}>
            {h.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Barangay"
        value={params.get('barangay_id') ?? ''}
        onChange={(e) => update({ barangay_id: e.target.value })}
      >
        <option value="">All barangays</option>
        {barangays.data?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

function ExportButton({ query, disabled }: { query: URLSearchParams; disabled: boolean }) {
  const api = useApiClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportCsv() {
    setBusy(true);
    setError(null);
    try {
      const file = await api.download(`/staff/analysis/incidents/export?${query}`);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename ?? 'beacon-incidents.csv';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      setError(
        err instanceof ApiError && !err.isNetworkError ? err.message : NETWORK_ERROR_MESSAGE,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="m-export">
      <Button
        variant="secondary"
        size="sm"
        icon={<Download size={16} aria-hidden="true" />}
        loading={busy}
        disabled={disabled}
        onClick={exportCsv}
      >
        Export CSV
      </Button>
      {error ? (
        <span className="m-export__error" role="alert">
          Export failed. {error}
        </span>
      ) : (
        <span className="m-cell-note">
          No reporter details or descriptions. Exports are logged.
        </span>
      )}
    </div>
  );
}

function formatMonth(month: string, style: 'short' | 'long' = 'short'): string {
  const [year, m] = month.split('-').map(Number);
  const names = style === 'short' ? MONTHS : MONTH_NAMES;
  return `${names[m! - 1]} ${year}`;
}

function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[month! - 1]} ${day}, ${year}`;
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString('en-PH')} ${word}${count === 1 ? '' : 's'}`;
}

/** The items with the highest count (several when tied); none when every count is 0. */
function leaders<T extends { count: number }>(items: T[]): T[] {
  const max = Math.max(0, ...items.map((i) => i.count));
  return max === 0 ? [] : items.filter((i) => i.count === max);
}

function joinNames(names: string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function AnalysisResults({ data }: { data: IncidentAnalysis }) {
  const { dataset } = data;
  const hazardNames = Object.fromEntries(data.by_hazard.map((h) => [h.code, h.name]));
  const topHazards = leaders(data.by_hazard);
  const topBarangays = leaders(data.by_barangay);
  const peakMonths = leaders(data.by_month_of_year);
  const scopeWord = data.filters.scope === 'confirmed' ? 'MDRRMO-confirmed' : 'recorded';

  const monthColumns: Column[] = data.by_month.map((m) => ({
    key: m.month,
    label: m.month.endsWith('-01') ? formatMonth(m.month) : MONTHS[Number(m.month.slice(5)) - 1]!,
    fullLabel: formatMonth(m.month, 'long'),
    value: m.count,
  }));

  return (
    <>
      <section className="bcn-stack" aria-labelledby="dataset-heading">
        <h2 id="dataset-heading" className="m-section-title">
          Dataset
        </h2>
        <div className="m-stats">
          <StatTile
            label="Records"
            value={dataset.total.toLocaleString('en-PH')}
            note={
              dataset.first_incident && dataset.last_incident
                ? `${formatDay(dataset.first_incident)} to ${formatDay(dataset.last_incident)}`
                : undefined
            }
          />
          <StatTile label="Submitted in the app" value={dataset.from_app.toLocaleString('en-PH')} />
          <StatTile
            label="Imported MDRRMO records"
            value={dataset.imported.toLocaleString('en-PH')}
          />
          <StatTile
            label="With a map pin"
            value={dataset.with_coordinates.toLocaleString('en-PH')}
            note={`${plural(dataset.with_time, 'record')} with a time of day`}
          />
        </div>
        {dataset.demo > 0 && (
          <Alert tone="warning" title="Includes DEMO DATA">
            {plural(dataset.demo, 'record')} in this analysis {dataset.demo === 1 ? 'is' : 'are'}{' '}
            fictional DEMO records, not real incidents. Clear "Include DEMO DATA records" to leave
            them out.
          </Alert>
        )}
        <Card>
          <ul className="m-findings">
            <li>
              The dataset contains {plural(dataset.total, `${scopeWord} record`)}
              {dataset.first_incident && dataset.last_incident
                ? `, with incident dates from ${formatDay(dataset.first_incident)} to ${formatDay(dataset.last_incident)}`
                : ''}
              .
            </li>
            <li>
              {topHazards.length === 1
                ? `${topHazards[0]!.name} was the most frequently recorded hazard type`
                : `${joinNames(topHazards.map((h) => h.name))} were recorded equally often, more than any other hazard type`}{' '}
              ({plural(topHazards[0]!.count, 'record')}
              {topHazards.length > 1 ? ' each' : ''}, {formatShare(topHazards[0]!.share)}).
            </li>
            {topBarangays.length === 1 && (
              <li>
                {topBarangays[0]!.name} had the most records ({topBarangays[0]!.count}); the hazard
                type recorded most often there was {hazardNames[topBarangays[0]!.top_hazard]}.
              </li>
            )}
            {topBarangays.length > 1 && (
              <li>
                {joinNames(topBarangays.map((b) => b.name))} had the most records (
                {topBarangays[0]!.count} each).
              </li>
            )}
            {peakMonths.length > 0 && peakMonths.length < 12 && (
              <li>
                More records fell in {joinNames(peakMonths.map((m) => MONTH_NAMES[m.key - 1]!))}{' '}
                than in any other month of the year ({plural(peakMonths[0]!.count, 'record')}
                {peakMonths.length > 1 ? ' each' : ''}, all years combined).
              </li>
            )}
          </ul>
          <p className="m-privacy-note">
            <Info size={16} aria-hidden="true" />
            {ANALYSIS_DISCLAIMER}
          </p>
        </Card>
      </section>

      <div className="m-history-grid">
        <Card title="Records by hazard type">
          <div className="m-table-wrap">
            <table className="m-table m-table--compact">
              <caption className="bcn-visually-hidden">Records by hazard type</caption>
              <thead>
                <tr>
                  <th scope="col">Hazard</th>
                  <th scope="col" className="m-num">
                    Records
                  </th>
                  <th scope="col">Share of records</th>
                </tr>
              </thead>
              <tbody>
                {data.by_hazard.map((h) => (
                  <tr key={h.code}>
                    <th scope="row">
                      <span className="m-hazard-cell">
                        <HazardIcon code={h.code} size={28} />
                        {h.name}
                      </span>
                    </th>
                    <td className="m-num">{h.count}</td>
                    <td>
                      <ShareBar share={h.share} max={data.by_hazard[0]!.share} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <BarangayTable data={data} hazardNames={hazardNames} />
      </div>

      <Card title="Records per month">
        <ColumnChart
          columns={monthColumns}
          caption="Records per month"
          headerLabel="Month"
          labelEvery={monthColumns.length > 36 ? 6 : monthColumns.length > 18 ? 3 : 1}
        />
      </Card>

      <div className="m-history-grid">
        <Card title="Records by month of the year">
          <p className="m-card-hint">All years combined.</p>
          <ColumnChart
            columns={data.by_month_of_year.map((m) => ({
              key: String(m.key),
              label: MONTHS[m.key - 1]!,
              fullLabel: MONTH_NAMES[m.key - 1]!,
              value: m.count,
            }))}
            caption="Records by month of the year, all years combined"
            headerLabel="Month"
          />
        </Card>
        <Card title="Records by day of the week">
          <ColumnChart
            columns={data.by_weekday.map((d) => ({
              key: String(d.key),
              label: WEEKDAYS[d.key - 1]!.slice(0, 3),
              fullLabel: WEEKDAYS[d.key - 1]!,
              value: d.count,
            }))}
            caption="Records by day of the week"
            headerLabel="Day"
          />
        </Card>
      </div>

      <Card title="Records by time of day">
        <p className="m-card-hint">
          Hour the incident happened (Philippine time).{' '}
          {data.unknown_time > 0 &&
            `${plural(data.unknown_time, 'record')} had no time and ${data.unknown_time === 1 ? 'is' : 'are'} not shown.`}
        </p>
        <ColumnChart
          columns={data.by_hour.map((h) => ({
            key: String(h.key),
            label: String(h.key).padStart(2, '0'),
            fullLabel: `${String(h.key).padStart(2, '0')}:00–${String(h.key).padStart(2, '0')}:59`,
            value: h.count,
          }))}
          caption="Records by hour of the day"
          headerLabel="Hour"
          labelEvery={3}
        />
      </Card>
    </>
  );
}

function BarangayTable({
  data,
  hazardNames,
}: {
  data: IncidentAnalysis;
  hazardNames: Record<string, string>;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? data.by_barangay : data.by_barangay.slice(0, BARANGAYS_SHOWN);
  const max = data.by_barangay[0]?.share ?? 0;
  return (
    <Card title="Records by barangay">
      <div className="m-table-wrap">
        <table className="m-table m-table--compact">
          <caption className="bcn-visually-hidden">Records by barangay</caption>
          <thead>
            <tr>
              <th scope="col">Barangay</th>
              <th scope="col" className="m-num">
                Records
              </th>
              <th scope="col">Share of records</th>
              <th scope="col">Most recorded hazard</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <th scope="row">{b.name}</th>
                <td className="m-num">{b.count}</td>
                <td>
                  <ShareBar share={b.share} max={max} />
                </td>
                <td>
                  {hazardNames[b.top_hazard] ?? b.top_hazard}{' '}
                  <span className="bcn-muted">({b.top_hazard_count})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.by_barangay.length > BARANGAYS_SHOWN && (
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show fewer' : `Show all ${data.by_barangay.length} barangays`}
        </Button>
      )}
      {data.without_barangay > 0 && (
        <p className="m-card-hint">{plural(data.without_barangay, 'record')} had no barangay.</p>
      )}
    </Card>
  );
}
