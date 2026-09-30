import { BellOff } from 'lucide-react';
import { EmptyState, PageHeader } from '@beacon/ui';

export function NotificationsScreen() {
  return (
    <>
      <PageHeader title="Notifications" />
      <EmptyState
        icon={<BellOff size={28} />}
        title="No notifications"
        description="You will be notified here when the MDRRMO updates the status of your reports."
      />
    </>
  );
}
