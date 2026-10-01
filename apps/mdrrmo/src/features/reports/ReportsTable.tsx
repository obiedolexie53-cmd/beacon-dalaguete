import { Link } from 'react-router';
import {
  formatIncidentDateTime,
  formatTimestamp,
  hazardLabel,
  type StaffReportRow,
} from '@beacon/shared';
import { DemoBadge, HazardIcon, StatusBadge } from '@beacon/ui';
import { ImportedBadge } from './ImportedBadge';
import { TableScroll } from '../TableScroll';

/** Report rows used on the dashboard and the Reports page. */
export function ReportsTable({ rows, caption }: { rows: StaffReportRow[]; caption: string }) {
  return (
    <TableScroll label={caption}>
      <table className="m-table">
        <caption className="bcn-visually-hidden">{caption}</caption>
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
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="m-ref-cell">
                  {row.reference_no}
                  {row.source === 'import' && <ImportedBadge />}
                  {row.is_demo && <DemoBadge>DEMO</DemoBadge>}
                </span>
              </td>
              <td>
                <span className="m-hazard-cell">
                  <HazardIcon code={row.hazard_type.code} size={32} />
                  {hazardLabel(row)}
                </span>
              </td>
              <td>{row.barangay?.name ?? '—'}</td>
              <td className="m-col-date">
                {formatIncidentDateTime(row.incident_date, row.incident_time)}
                <span className="m-cell-note">Submitted {formatTimestamp(row.submitted_at)}</span>
              </td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>
                <Link
                  to={`/reports/${row.reference_no}`}
                  aria-label={`Review report ${row.reference_no}`}
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
