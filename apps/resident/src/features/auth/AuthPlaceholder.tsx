import { Link, useNavigate } from 'react-router';
import { KeyRound } from 'lucide-react';
import { Alert, Card, EmptyState, PageHeader, buttonClassName } from '@beacon/ui';

/**
 * Temporary Login/Registration screen for Phase 2 navigation review.
 * Replaced by the real forms and authentication in Phase 3.
 */
export function AuthPlaceholder({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const title = mode === 'login' ? 'Log in' : 'Create an account';

  return (
    <main className="r-screen bcn-stack">
      <PageHeader title={title} onBack={() => navigate('/welcome')} />
      <Card>
        <EmptyState
          icon={<KeyRound size={28} />}
          title={`${title} is coming in Phase 3`}
          description="Resident sign-in and registration are built in the next phase."
        />
      </Card>
      <Alert tone="info" title="Design preview">
        You can explore the resident navigation with sample content before sign-in exists.
      </Alert>
      <Link to="/home" className={buttonClassName('primary', { block: true })}>
        Preview the resident app
      </Link>
    </main>
  );
}
