import { useNavigate } from 'react-router';
import { BellOff } from 'lucide-react';
import { useApiClient, useApiQuery } from '@beacon/auth';
import { formatTimestamp, type NotificationItem, type NotificationList } from '@beacon/shared';
import { Button, EmptyState, PageHeader, Skeleton, cx } from '@beacon/ui';
import { LoadError } from '../reports/LoadError';
import { useNotifications } from './NotificationsProvider';

export function NotificationsScreen() {
  const api = useApiClient();
  const navigate = useNavigate();
  const query = useApiQuery<NotificationList>('/me/notifications');
  const { refresh } = useNotifications();
  const list = query.data;

  async function open(item: NotificationItem) {
    if (!item.read) {
      await api.post(`/me/notifications/${item.id}/read`).catch(() => undefined);
      refresh();
    }
    if (item.report_reference_no) navigate(`/my-reports/${item.report_reference_no}`);
    else query.reload();
  }

  async function markAllRead() {
    await api.post('/me/notifications/read-all').catch(() => undefined);
    refresh();
    query.reload();
  }

  return (
    <div className="bcn-stack">
      <PageHeader
        title="Notifications"
        actions={
          list && list.unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />
      {query.error ? (
        <LoadError
          title="Could not load notifications"
          error={query.error}
          onRetry={query.reload}
        />
      ) : !list ? (
        <>
          <Skeleton height={72} />
          <Skeleton height={72} />
        </>
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={<BellOff size={28} />}
          title="No notifications"
          description="You will be notified here when the MDRRMO updates the status of your reports."
        />
      ) : (
        <ul className="r-notifications">
          {list.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={cx('r-notification', !item.read && 'is-unread')}
                onClick={() => open(item)}
                aria-label={`${item.read ? '' : 'Unread. '}${item.title}. ${item.body} ${formatTimestamp(item.created_at)}`}
              >
                <strong>{item.title}</strong>
                <span>{item.body}</span>
                <span className="bcn-muted r-notification__time">
                  {formatTimestamp(item.created_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
