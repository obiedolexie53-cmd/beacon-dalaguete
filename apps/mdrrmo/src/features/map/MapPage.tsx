import { useState } from 'react';
import { Link } from 'react-router';
import { List, MapPin, MapPinOff, X } from 'lucide-react';
import { useApiQuery } from '@beacon/auth';
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  formatIncidentDateTime,
  hazardLabel,
  type MapData,
  type MapPoint,
} from '@beacon/shared';
import {
  Alert,
  Button,
  Card,
  DemoBadge,
  HazardIcon,
  PageHeader,
  StatusBadge,
  buttonClassName,
  statusIconFor,
  statusMarkerColors,
} from '@beacon/ui';
import {
  DemoToggle,
  FIELD_FILTER_KEYS,
  ReportFilterFields,
  useReportFilters,
} from '../reports/ReportFilters';
import { ImportedBadge } from '../reports/ImportedBadge';
import { DisasterMap } from './DisasterMap';
import { TableScroll } from '../TableScroll';

export function MapPage() {
  const filters = useReportFilters();
  const query = useApiQuery<MapData>(`/staff/map/reports?${filters.apiQuery(FIELD_FILTER_KEYS)}`);
  const [selected, setSelected] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const data = query.data;
  const points = data?.points ?? EMPTY;
  const selectedPoint = points.find((p) => p.reference_no === selected) ?? null;
  const reportsLink = `/reports?${new URLSearchParams(
    [...filters.params].filter(([key]) => key !== 'page'),
  )}`;

  return (
    <div className="bcn-stack">
      <PageHeader
        title="Disaster Map"
        subtitle="Recorded reports in Dalaguete. Filter by hazard, barangay, date and status."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<List size={16} aria-hidden="true" />}
            aria-expanded={showList}
            onClick={() => setShowList((v) => !v)}
          >
            {showList ? 'Hide list' : 'Show as list'}
          </Button>
        }
      />

      <Card className="m-filters">
        <ReportFilterFields filters={filters} />
        <div className="m-filters__footer">
          <DemoToggle filters={filters} />
          {filters.has(FIELD_FILTER_KEYS) && (
            <Button variant="ghost" size="sm" onClick={() => filters.clear(FIELD_FILTER_KEYS)}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {query.error !== null && (
        <Alert
          tone="danger"
          title="Could not load the map data"
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
      )}
      {data?.truncated && (
        <Alert tone="warning" title="Not every report is shown">
          More reports match than the map can show at once. Narrow the filters to see them all.
        </Alert>
      )}

      <div className="m-map-layout">
        <div className="bcn-stack" style={{ gap: 'var(--bcn-space-3)' }}>
          <p className="bcn-muted m-results" aria-live="polite" style={{ margin: 0 }}>
            {data
              ? `${points.length} ${points.length === 1 ? 'report' : 'reports'} on the map`
              : 'Loading reports…'}
          </p>
          <DisasterMap points={points} selected={selected} onSelect={setSelected} />
          <MapLegend />
          {data && data.without_location > 0 && (
            <p className="m-map-note">
              <MapPinOff size={16} aria-hidden="true" />
              {data.without_location} matching{' '}
              {data.without_location === 1 ? 'report has' : 'reports have'} no map pin (landmark
              only) and {data.without_location === 1 ? 'is' : 'are'} not shown.{' '}
              <Link to={reportsLink}>View in Reports</Link>
            </p>
          )}
        </div>
        <aside className="m-map-panel" aria-live="polite">
          {selectedPoint ? (
            <SelectedReport point={selectedPoint} onClose={() => setSelected(null)} />
          ) : (
            <Card>
              <p className="m-map-panel__hint">
                <MapPin size={20} aria-hidden="true" />
                Select a marker to see a summary of the report.
              </p>
            </Card>
          )}
        </aside>
      </div>

      {showList && data && <MapList points={points} onSelect={setSelected} />}
    </div>
  );
}

const EMPTY: MapPoint[] = [];

function SelectedReport({ point, onClose }: { point: MapPoint; onClose: () => void }) {
  return (
    <Card className="bcn-stack" aria-label={`Summary of report ${point.reference_no}`}>
      <div className="m-map-panel__head">
        <HazardIcon code={point.hazard_type.code} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>{hazardLabel(point)}</strong>
          <div className="m-ref-cell">
            {point.reference_no}
            {point.source === 'import' && <ImportedBadge />}
            {point.is_demo && <DemoBadge>DEMO</DemoBadge>}
          </div>
        </div>
        <button
          type="button"
          className="bcn-icon-button"
          aria-label="Close summary"
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div>
        <StatusBadge status={point.status} />
      </div>
      <dl className="m-detail-list">
        <dt>Barangay</dt>
        <dd>{point.barangay?.name ?? 'Not given'}</dd>
        {point.landmark && (
          <>
            <dt>Landmark</dt>
            <dd>{point.landmark}</dd>
          </>
        )}
        <dt>Date and time</dt>
        <dd>{formatIncidentDateTime(point.incident_date, point.incident_time)}</dd>
        <dt>GPS coordinates</dt>
        <dd>
          {point.latitude}, {point.longitude}
        </dd>
      </dl>
      <Link
        to={`/reports/${point.reference_no}`}
        className={buttonClassName('primary', { block: true })}
      >
        Review report
      </Link>
    </Card>
  );
}

function MapLegend() {
  return (
    <div className="m-legend" aria-label="Map legend">
      <span className="m-legend__title">Marker colour and small icon: status</span>
      <ul>
        {REPORT_STATUSES.map((status) => {
          const Icon = statusIconFor(status);
          return (
            <li key={status}>
              <span
                className="m-legend__swatch"
                style={{ background: statusMarkerColors[status] }}
                aria-hidden="true"
              >
                <Icon size={11} color="#fff" strokeWidth={3} />
              </span>
              {REPORT_STATUS_LABELS[status]}
            </li>
          );
        })}
      </ul>
      <span className="m-legend__title">Icon inside the marker: hazard type</span>
    </div>
  );
}

/** The same reports as a table: an alternative to the map for keyboard and screen reader users. */
function MapList({
  points,
  onSelect,
}: {
  points: MapPoint[];
  onSelect: (referenceNo: string) => void;
}) {
  return (
    <Card title="Reports on the map">
      {points.length === 0 ? (
        <p className="bcn-muted" style={{ margin: 0 }}>
          No reports match these filters.
        </p>
      ) : (
        <TableScroll label="Reports shown on the map">
          <table className="m-table">
            <caption className="bcn-visually-hidden">Reports shown on the map</caption>
            <thead>
              <tr>
                <th scope="col">Report ID</th>
                <th scope="col">Hazard</th>
                <th scope="col">Barangay</th>
                <th scope="col" className="m-col-date">
                  Date/time
                </th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.reference_no}>
                  <td>
                    <span className="m-ref-cell">
                      {point.reference_no}
                      {point.source === 'import' && <ImportedBadge />}
                      {point.is_demo && <DemoBadge>DEMO</DemoBadge>}
                    </span>
                  </td>
                  <td>
                    <span className="m-hazard-cell">
                      <HazardIcon code={point.hazard_type.code} size={32} />
                      {hazardLabel(point)}
                    </span>
                  </td>
                  <td>{point.barangay?.name ?? '—'}</td>
                  <td className="m-col-date">
                    {formatIncidentDateTime(point.incident_date, point.incident_time)}
                  </td>
                  <td>
                    <StatusBadge status={point.status} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="m-link-button"
                      onClick={() => onSelect(point.reference_no)}
                    >
                      Show on map
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Card>
  );
}
