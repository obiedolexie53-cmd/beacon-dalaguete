import { useSearchParams } from 'react-router';
import { useApiQuery } from '@beacon/auth';
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  type Barangay,
  type HazardType,
} from '@beacon/shared';
import { CheckboxField, DemoBadge, SelectField, TextField } from '@beacon/ui';

/** Filters shared by the Reports list and the Disaster Map, kept in the page URL. */
export const FIELD_FILTER_KEYS = [
  'status',
  'hazard',
  'barangay_id',
  'date_from',
  'date_to',
] as const;

export interface ReportFilterState {
  params: URLSearchParams;
  includeDemo: boolean;
  /** Set or clear URL parameters; any change except paging returns to page 1. */
  update(changes: Record<string, string | null>): void;
  /** Whether any of `keys` is set. */
  has(keys: readonly string[]): boolean;
  /** Remove the given filters, keeping the demo setting. */
  clear(keys: readonly string[]): void;
  /** API query string for `keys` plus include_demo. */
  apiQuery(keys: readonly string[]): URLSearchParams;
}

export function useReportFilters(): ReportFilterState {
  const [params, setParams] = useSearchParams();
  const includeDemo = params.get('demo') !== '0';

  return {
    params,
    includeDemo,
    update(changes) {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (!('page' in changes)) next.delete('page');
      setParams(next);
    },
    has(keys) {
      return keys.some((key) => params.get(key));
    },
    clear(keys) {
      const next = new URLSearchParams(params);
      for (const key of [...keys, 'page']) next.delete(key);
      setParams(next);
    },
    apiQuery(keys) {
      const query = new URLSearchParams();
      for (const key of keys) {
        const value = params.get(key);
        if (value) query.set(key, value);
      }
      query.set('include_demo', String(includeDemo));
      return query;
    },
  };
}

/** Status, hazard, barangay and incident-date filters. */
export function ReportFilterFields({ filters }: { filters: ReportFilterState }) {
  const hazards = useApiQuery<HazardType[]>('/hazard-types');
  const barangays = useApiQuery<Barangay[]>('/barangays');
  const { params, update } = filters;

  return (
    <div className="m-filters__grid">
      <SelectField
        label="Status"
        value={params.get('status') ?? ''}
        onChange={(e) => update({ status: e.target.value })}
      >
        <option value="">All statuses</option>
        {REPORT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {REPORT_STATUS_LABELS[status]}
          </option>
        ))}
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
    </div>
  );
}

export function DemoToggle({ filters }: { filters: ReportFilterState }) {
  return (
    <CheckboxField
      label={
        <>
          Include <DemoBadge /> records
        </>
      }
      checked={filters.includeDemo}
      onChange={(e) => filters.update({ demo: e.target.checked ? null : '0' })}
    />
  );
}
