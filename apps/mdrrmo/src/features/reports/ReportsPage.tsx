import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, FileSearch, Search } from 'lucide-react';
import { useApiQuery } from '@beacon/auth';
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  type Barangay,
  type HazardType,
  type StaffReportPage,
} from '@beacon/shared';
import {
  Alert,
  Button,
  Card,
  CheckboxField,
  DemoBadge,
  EmptyState,
  PageHeader,
  SelectField,
  Skeleton,
  TextField,
} from '@beacon/ui';
import { ReportsTable } from './ReportsTable';

export const PAGE_SIZE = 20;

/** Filter keys kept in the URL, so filtered lists can be bookmarked and linked from the dashboard. */
const FILTER_KEYS = ['q', 'status', 'hazard', 'barangay_id', 'date_from', 'date_to'] as const;

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const includeDemo = params.get('demo') !== '0';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const apiParams = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = params.get(key);
    if (value) apiParams.set(key, value);
  }
  apiParams.set('include_demo', String(includeDemo));
  apiParams.set('limit', String(PAGE_SIZE));
  apiParams.set('offset', String((page - 1) * PAGE_SIZE));
  const query = useApiQuery<StaffReportPage>(`/staff/reports?${apiParams}`);
  const hazards = useApiQuery<HazardType[]>('/hazard-types');
  const barangays = useApiQuery<Barangay[]>('/barangays');

  const [search, setSearch] = useState(params.get('q') ?? '');

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page'); // any filter change starts at page 1
    setParams(next);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    update({ q: search.trim() || null });
  }

  const hasFilters = FILTER_KEYS.some((key) => params.get(key));
  const data = query.data;
  const from = data && data.total > 0 ? data.offset + 1 : 0;
  const to = data ? data.offset + data.items.length : 0;

  return (
    <div className="bcn-stack">
      <PageHeader
        title="Reports"
        subtitle="Search, filter and review disaster reports submitted by residents."
      />

      <Card className="m-filters">
        <form className="m-filters__search" onSubmit={submitSearch} role="search">
          <TextField
            label="Search"
            hint="Reference number, description, landmark or reporter name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" icon={<Search size={18} aria-hidden="true" />}>
            Search
          </Button>
        </form>
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
        <div className="m-filters__footer">
          <CheckboxField
            label={
              <>
                Include <DemoBadge /> records
              </>
            }
            checked={includeDemo}
            onChange={(e) => update({ demo: e.target.checked ? null : '0' })}
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setParams(includeDemo ? {} : { demo: '0' });
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {query.error ? (
        <Alert
          tone="danger"
          title="Could not load reports"
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
      ) : (
        <Card>
          {!data ? (
            <div className="bcn-stack" style={{ gap: 12 }}>
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </div>
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={<FileSearch size={28} />}
              title={hasFilters ? 'No reports match these filters' : 'No reports available'}
              description={
                hasFilters ? 'Try other filters or clear them.' : 'Submitted reports appear here.'
              }
            />
          ) : (
            <>
              <p className="bcn-muted m-results" aria-live="polite">
                Showing {from}–{to} of {data.total} {data.total === 1 ? 'report' : 'reports'}
              </p>
              <ReportsTable rows={data.items} caption="Reports matching the current filters" />
              <nav className="m-pagination" aria-label="Pages">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  icon={<ChevronLeft size={16} aria-hidden="true" />}
                  onClick={() => update({ page: String(page - 1) })}
                >
                  Previous
                </Button>
                <span>
                  Page {page} of {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={to >= data.total}
                  onClick={() => update({ page: String(page + 1) })}
                >
                  Next
                  <ChevronRight size={16} aria-hidden="true" />
                </Button>
              </nav>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
