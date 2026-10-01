import { ApiError, NETWORK_ERROR_MESSAGE } from '@beacon/shared';
import { Alert, Button } from '@beacon/ui';

/** Shown when a list or dashboard fails to load, with a retry button. */
export function LoadError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  const message =
    error instanceof ApiError && !error.isNetworkError ? error.message : NETWORK_ERROR_MESSAGE;
  return (
    <Alert
      tone="danger"
      title={title}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    >
      {message}
    </Alert>
  );
}
