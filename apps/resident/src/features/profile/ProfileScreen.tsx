import { Link } from 'react-router';
import { Card, DemoBadge, PageHeader, buttonClassName } from '@beacon/ui';
import { DEMO_RESIDENT } from '../../demo/demoData';

export function ProfileScreen() {
  const rows: Array<[string, string]> = [
    ['Name', DEMO_RESIDENT.fullName],
    ['Role', DEMO_RESIDENT.role],
    ['Location', `${DEMO_RESIDENT.municipality}, ${DEMO_RESIDENT.province}`],
  ];

  return (
    <div className="bcn-stack">
      <PageHeader title="Profile" actions={<DemoBadge />} />
      <Card>
        <dl style={{ margin: 0 }}>
          {rows.map(([label, value]) => (
            <div key={label} className="r-profile-row">
              <dt className="bcn-muted">{label}</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Link to="/welcome" className={buttonClassName('secondary', { block: true })}>
        Exit preview
      </Link>
    </div>
  );
}
