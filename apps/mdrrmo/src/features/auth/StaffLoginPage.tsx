import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@beacon/auth';
import { ApiError, NETWORK_ERROR_MESSAGE } from '@beacon/shared';
import {
  Alert,
  Button,
  Card,
  LoadingScreen,
  Logo,
  OfflineBanner,
  PasswordField,
  TextField,
} from '@beacon/ui';
import type { LoginRedirectState } from '../../app/guards';

export function StaffLoginPage() {
  const { status, login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as LoginRedirectState | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'authenticated' && !submitting) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = {
      email: email.trim() ? undefined : 'Enter your email',
      password: password ? undefined : 'Enter your password',
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  const errorMessage =
    error instanceof ApiError
      ? error.isNetworkError
        ? NETWORK_ERROR_MESSAGE
        : error.message
      : 'Something went wrong. Please try again.';

  return (
    <>
      <OfflineBanner />
      <main className="m-login">
        <Card className="m-login__card bcn-stack">
          <Logo size={44} />
          <div>
            <h1>MDRRMO Staff Login</h1>
            <p className="bcn-muted">
              For authorized personnel of the Dalaguete Municipal Disaster Risk Reduction and
              Management Office.
            </p>
          </div>

          {sessionExpired && !error && (
            <Alert tone="info" title="Session ended">
              Your session has ended. Please log in again.
            </Alert>
          )}
          {error !== null && (
            <Alert tone="danger" title="Could not log in">
              {errorMessage}
            </Alert>
          )}

          <form className="bcn-stack" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
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
            <Button
              type="submit"
              block
              loading={submitting}
              icon={<ShieldCheck size={20} aria-hidden="true" />}
            >
              Log in
            </Button>
          </form>

          <p className="bcn-muted" style={{ fontSize: 'var(--bcn-text-sm)', margin: 0 }}>
            There is no public registration. Staff accounts are issued by the MDRRMO administrator.
          </p>
        </Card>
      </main>
    </>
  );
}
