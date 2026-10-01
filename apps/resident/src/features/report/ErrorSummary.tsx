import { Alert } from '@beacon/ui';

/** "Missing required information" summary shown when a step has errors. */
export function ErrorSummary({ errors }: { errors: Record<string, string | undefined> }) {
  const messages = Object.values(errors).filter(Boolean);
  if (messages.length === 0) return null;
  return (
    <Alert tone="danger" title="Missing required information">
      <ul className="r-error-list">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </Alert>
  );
}
