import { ApiError, NETWORK_ERROR_MESSAGE } from '@beacon/shared';
import { Alert } from '@beacon/ui';

/** Form-level error message for a failed auth request. */
export function AuthErrorAlert({ error, title }: { error: unknown; title: string }) {
  if (!error) return null;
  if (error instanceof ApiError && error.isNetworkError) {
    return (
      <Alert tone="danger" title="No connection">
        {NETWORK_ERROR_MESSAGE}
      </Alert>
    );
  }
  const message =
    error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
  return (
    <Alert tone="danger" title={title}>
      {message}
    </Alert>
  );
}
