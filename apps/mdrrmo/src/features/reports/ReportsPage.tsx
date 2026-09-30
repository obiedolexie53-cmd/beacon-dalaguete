import { useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, FileSearch, Search } from 'lucide-react';
import { useApiQuery } from '@beacon/auth';
import { ApiError, NETWORK_ERROR_MESSAGE, type StaffReportPage } from '@beacon/shared';
import { Alert, Button, Card, EmptyState, PageHeader, Skeleton, TextField } from '@beacon/ui';
import {
  DemoToggle,
  FIELD_FILTER_KEYS,
  ReportFilterFields,
  useReportFilters,
} from './ReportFilters';
import { ReportsTable } from './ReportsTable';

export const PAGE_SIZE = 20;

/** Filter keys kept in the URL, so filtered lists can be bookmarked and linked from the dashboard. */
const FILTER_KEYS = ['q', ...FIELD_FILTER_KEYS] as const;

export function ReportsPage() {
  const filters = useReportFilters();
  const { params, update } = filters;
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const apiParams = filters.apiQuery(FILTER_KEYS);
  apiParams.set('limit', String(PAGE_SIZE));
  apiParams.set('offset', String((page - 1) * PAGE_SIZE));
  const query = useApiQuery<StaffReportPage>(`/staff/reports?${apiParams}`);

  const [search, setSearch] = useState(params.get('q') ?? '');

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    update({ q: search.trim() || null });
  }

  const hasFilters = filters.has(FILTER_KEYS);
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
        <ReportFilterFields filters={filters} />
        <div className="m-filters__footer">
          <DemoToggle filters={filters} />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                filters.clear(FILTER_KEYS);
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
