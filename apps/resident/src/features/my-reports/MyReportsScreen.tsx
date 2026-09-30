import { Link } from 'react-router';
import { ClipboardList } from 'lucide-react';
import { EmptyState, PageHeader, buttonClassName } from '@beacon/ui';

export function MyReportsScreen() {
  return (
    <>
      <PageHeader title="My Reports" subtitle="Only you can see the reports you submit." />
      <EmptyState
        icon={<ClipboardList size={28} />}
        title="No reports yet"
        description="When you submit a disaster report, you can follow its status here."
        action={
          <Link to="/report" className={buttonClassName('primary')}>
            Report a Disaster
          </Link>
        }
      />
    </>
  );
}
