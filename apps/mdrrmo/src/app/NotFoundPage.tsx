import { Link } from 'react-router';
import { MapPinOff } from 'lucide-react';
import { EmptyState, buttonClassName } from '@beacon/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<MapPinOff size={28} />}
      title="Page not found"
      description="The page you are looking for does not exist."
      action={
        <Link to="/dashboard" className={buttonClassName('primary')}>
          Go to Dashboard
        </Link>
      }
    />
  );
}
