import { Link } from 'react-router';
import {
  CircleCheckBig,
  FileText,
  Inbox,
  Search,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { Card, DemoBadge, HazardIcon, PageHeader, StatusBadge } from '@beacon/ui';
import { DEMO_REPORT_ROWS } from '../../demo/demoData';

const STAT_CARDS: Array<{ label: string; Icon: LucideIcon }> = [
  { label: 'Total reports', Icon: FileText },
  { label: 'New reports', Icon: Inbox },
  { label: 'Under verification', Icon: Search },
  { label: 'Verified', Icon: ShieldCheck },
  { label: 'Resolved', Icon: CircleCheckBig },
];

export function DashboardPage() {
  return (
    <div className="bcn-stack">
      <PageHeader
        title="Monitoring Dashboard"
        subtitle="Overview of disaster reports submitted by residents of Dalaguete."
      />

      <div className="m-stats" aria-label="Report counts">
        {STAT_CARDS.map(({ label, Icon }) => (
          <Card key={label} className="m-stat">
            <span className="m-stat__label">
              <Icon size={18} aria-hidden="true" />
              {label}
            </span>
            <span className="m-stat__value" aria-label={`${label}: not yet available`}>
              —
            </span>
          </Card>
        ))}
      </div>
      <p className="bcn-muted" style={{ fontSize: 'var(--bcn-text-sm)', margin: 0 }}>
        Live counts are connected in Phase 9.
      </p>

      <Card
        title={
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            Recent reports <DemoBadge />
          </span>
        }
      >
        <div className="m-table-wrap">
          <table className="m-table">
            <thead>
              <tr>
                <th scope="col">Report ID</th>
                <th scope="col">Hazard</th>
                <th scope="col">Barangay</th>
                <th scope="col">Date/time</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_REPORT_ROWS.map((row) => (
                <tr key={row.referenceNo}>
                  <td>{row.referenceNo}</td>
                  <td>
                    <span className="m-hazard-cell">
                      <HazardIcon code={row.hazardCode} size={32} />
                      {row.hazardName}
                    </span>
                  </td>
                  <td>{row.barangay}</td>
                  <td>{row.dateTime}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>
                    <Link to="/reports">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
