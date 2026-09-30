import { useState } from 'react';
import { Link } from 'react-router';
import { LogOut } from 'lucide-react';
import { useAuth } from '@beacon/auth';
import { Button, Card, DemoBadge, PageHeader } from '@beacon/ui';
import { MUNICIPALITY, PROVINCE, formatPhMobile } from '@beacon/shared';

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  if (!user) return null;

  const rows: Array<[string, string]> = [
    ['Name', user.full_name],
    ['Role', 'Resident'],
    ['Email', user.email ?? 'Not provided'],
    ['Mobile number', user.phone ? formatPhMobile(user.phone) : 'Not provided'],
    ['Barangay', user.barangay?.name ?? 'Not set'],
    ['Municipality', `${MUNICIPALITY}, ${PROVINCE}`],
  ];

  // After logout the route guard returns the resident to the Welcome screen.
  // If the network is down the device session is still cleared locally.
  async function handleLogout() {
    setLoggingOut(true);
    await logout().catch(() => undefined);
  }

  return (
    <div className="bcn-stack">
      <PageHeader title="Profile" actions={user.is_demo ? <DemoBadge /> : undefined} />
      <Card>
        <dl style={{ margin: 0 }}>
          {rows.map(([label, value]) => (
            <div key={label} className="r-profile-row">
              <dt className="bcn-muted">{label}</dt>
              <dd
                style={{ margin: 0, fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere' }}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      <Link to="/privacy">Privacy Notice</Link>
      <Button
        variant="secondary"
        block
        loading={loggingOut}
        icon={<LogOut size={20} aria-hidden="true" />}
        onClick={handleLogout}
      >
        Log out
      </Button>
    </div>
  );
}
