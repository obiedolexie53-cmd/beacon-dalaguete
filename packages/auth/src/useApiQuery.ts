import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './AuthProvider';

export interface ApiQuery<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  /** Fetch again (e.g. from a "Try again" button). */
  reload: () => void;
}

/** GET `path` with the signed-in user's API client, tracking loading and error state. */
export function useApiQuery<T>(path: string): ApiQuery<T> {
  const client = useApiClient();
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    client.get<T>(path).then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (error: unknown) => !cancelled && setState((s) => ({ ...s, error, loading: false })),
    );
    return () => {
      cancelled = true;
    };
  }, [client, path, attempt]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, error: null, loading: true }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
