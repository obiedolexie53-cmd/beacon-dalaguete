import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** Tracks the browser's online/offline state. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

export function OfflineBanner({
  message = 'No internet connection. Some features are unavailable until you reconnect.',
}: {
  message?: string;
}) {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="bcn-offline-banner" role="alert">
      <WifiOff size={18} aria-hidden="true" />
      {message}
    </div>
  );
}
