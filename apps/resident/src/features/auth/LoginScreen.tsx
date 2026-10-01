import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@beacon/auth';
import { Alert, Button, PasswordField, TextField } from '@beacon/ui';
import type { LoginRedirectState } from '../../app/guards';
import { AuthLayout } from './AuthLayout';
import { AuthErrorAlert } from './errors';

export function LoginScreen() {
  const { login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as LoginRedirectState | null)?.from;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = {
      identifier: identifier.trim() ? undefined : 'Enter your email or mobile number',
      password: password ? undefined : 'Enter your password',
    };
    setFieldErrors(errors);
    if (errors.identifier || errors.password) return;

    setSubmitting(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      navigate(from && from !== '/login' ? from : '/home', { replace: true });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Log in" subtitle="Welcome back. Sign in to report and track incidents.">
      {sessionExpired && !error && (
        <Alert tone="info" title="Session ended">
          Your session has ended. Please log in again.
        </Alert>
      )}
      <AuthErrorAlert error={error} title="Could not log in" />

      <form className="bcn-stack" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Email or mobile number"
          name="identifier"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={fieldErrors.identifier}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <Button type="submit" block loading={submitting}>
          Log in
        </Button>
      </form>

      <p className="bcn-muted" style={{ textAlign: 'center' }}>
        New to BEACON? <Link to="/register">Create an account</Link>
      </p>
      <p className="bcn-muted" style={{ textAlign: 'center', fontSize: 'var(--bcn-text-sm)' }}>
        Forgot your password? Please contact the Dalaguete MDRRMO for help.
      </p>
    </AuthLayout>
  );
}
