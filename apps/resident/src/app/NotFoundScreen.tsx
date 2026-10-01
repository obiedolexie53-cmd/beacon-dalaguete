import { Link } from 'react-router';
import { MapPinOff } from 'lucide-react';
import { EmptyState, buttonClassName } from '@beacon/ui';

export function NotFoundScreen() {
  return (
    <main className="r-screen">
      <EmptyState
        icon={<MapPinOff size={28} />}
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Link to="/home" className={buttonClassName('primary')}>
            Go to Home
          </Link>
        }
      />
    </main>
  );
}
