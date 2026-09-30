import { Link } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { Alert, Card, Logo, buttonClassName } from '@beacon/ui';

/**
 * Temporary staff login for Phase 2 navigation review. Replaced by secure
 * authentication in Phase 3. MDRRMO accounts are never self-registered.
 */
export function StaffLoginPlaceholder() {
  return (
    <main className="m-login">
      <Card className="m-login__card bcn-stack">
        <Logo size={44} />
        <div>
          <h1>MDRRMO Staff Login</h1>
          <p className="bcn-muted">
            For authorized personnel of the Dalaguete Municipal Disaster Risk Reduction and
            Management Office.
          </p>
        </div>
        <Alert tone="info" title="No public registration">
          Staff accounts are issued by the MDRRMO administrator.
        </Alert>
        <Alert tone="warning" title="Secure login is built in Phase 3">
          This preview lets reviewers explore the console layout with sample content.
        </Alert>
        <Link to="/dashboard" className={buttonClassName('primary', { block: true })}>
          <ShieldCheck size={20} aria-hidden="true" />
          Preview the console
        </Link>
      </Card>
    </main>
  );
}
