import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useApiClient } from '@beacon/auth';

const POLL_MS = 60_000;

interface NotificationsContextValue {
  unread: number;
  refresh(): void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unread: 0,
  refresh: () => undefined,
});

/** Unread count for the navigation badge: polled every minute and when the app is reopened. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const api = useApiClient();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    api.get<{ unread: number }>('/me/notifications/unread-count').then(
      (body) => setUnread(body.unread),
      () => undefined, // keep the last known count while offline
    );
  }, [api]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const value = useMemo(() => ({ unread, refresh }), [unread, refresh]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
