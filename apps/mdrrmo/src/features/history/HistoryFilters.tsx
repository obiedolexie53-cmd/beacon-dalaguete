import { useApiQuery } from '@beacon/auth';
import type { Barangay, HazardType } from '@beacon/shared';
import { SelectField, TextField } from '@beacon/ui';
import type { ReportFilterState } from '../reports/ReportFilters';
import { PERIODS, matchPeriod, periodRange } from './periods';

/** Filters shared by Historical Reports and Pattern Analysis, kept in the page URL. */
export const HISTORY_FILTER_KEYS = [
  'scope',
  'hazard',
  'barangay_id',
  'source',
  'date_from',
  'date_to',
] as const;

export function HistoryFilterFields({ filters }: { filters: ReportFilterState }) {
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
