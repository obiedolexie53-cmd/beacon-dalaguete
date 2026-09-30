import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApiClient, useAuth } from '@beacon/auth';
import { ApiError, type Barangay, type RegisterRequest } from '@beacon/shared';
import {
  Alert,
  Button,
  Card,
  CheckboxField,
  PasswordField,
  SelectField,
  TextField,
} from '@beacon/ui';
import { AuthLayout } from './AuthLayout';
import { AuthErrorAlert } from './errors';
import { PrivacyNotice } from './PrivacyNotice';

type FieldName =
  'full_name' | 'email' | 'phone' | 'barangay_id' | 'password' | 'confirm' | 'privacy_consent';
type FieldErrors = Partial<Record<FieldName, string>>;

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  barangay_id: string;
  password: string;
  confirm: string;
  privacy_consent: boolean;
}

const EMPTY: FormState = {
  full_name: '',
  email: '',
  phone: '',
  barangay_id: '',
  password: '',
  confirm: '',
  privacy_consent: false,
};

/** Client-side checks mirror the API's rules so residents get instant feedback. */
export function validateRegistration(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (form.full_name.trim().length < 2) errors.full_name = 'Enter your full name';
  if (!form.email.trim() && !form.phone.trim()) {
    errors.email = 'Provide an email address or a mobile number';
  } else if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  if (form.phone.trim() && !/^(?:\+?63|0)?9\d{9}$/.test(form.phone.replace(/[\s\-().]/g, ''))) {
    errors.phone = 'Enter a valid Philippine mobile number, e.g. 0917 123 4567';
  }
  if (!form.barangay_id) errors.barangay_id = 'Select your barangay';
  if (form.password.length < 8) errors.password = 'Use at least 8 characters';
  if (form.confirm !== form.password) errors.confirm = 'Passwords do not match';
  if (!form.privacy_consent) {
    errors.privacy_consent = 'You must agree to the privacy notice to create an account';
  }
  return errors;
}

function useBarangays() {
  const api = useApiClient();
  const [barangays, setBarangays] = useState<Barangay[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get<Barangay[]>('/barangays').then(
      (list) => !cancelled && setBarangays(list),
      (err: unknown) => !cancelled && setError(err),
    );
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { barangays, error, retry };
}

export function RegisterScreen() {
  const { startSession } = useAuth();
  const navigate = useNavigate();
  const { barangays, error: barangayError, retry } = useBarangays();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const set =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateRegistration(form);
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0) return;

    const body: RegisterRequest = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      barangay_id: Number(form.barangay_id),
      password: form.password,
      privacy_consent: form.privacy_consent,
    };
    setSubmitting(true);
    try {
      await startSession('/auth/register', body);
      navigate('/home', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) {
        setErrors(err.fields as FieldErrors);
        if (err.fields.request)
          setSubmitError(new ApiError(err.status, err.code, err.fields.request));
      } else {
        setSubmitError(err);
      }
      setSubmitting(false);
    }
  }

  const hasFieldErrors = Object.keys(errors).length > 0;

  return (
    <AuthLayout title="Create an account" subtitle="For residents of Dalaguete, Cebu.">
      <AuthErrorAlert error={submitError} title="Account not created" />
      {hasFieldErrors && !submitError && (
        <Alert tone="danger" title="Missing or invalid information">
          Please check the highlighted fields.
        </Alert>
      )}

      <form className="bcn-stack" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Full name"
          name="full_name"
          autoComplete="name"
          required
          value={form.full_name}
          onChange={(e) => set('full_name')(e.target.value)}
          error={errors.full_name}
        />
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          hint="Provide an email, a mobile number, or both."
          value={form.email}
          onChange={(e) => set('email')(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="Mobile number"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0917 123 4567"
          value={form.phone}
          onChange={(e) => set('phone')(e.target.value)}
          error={errors.phone}
        />

        {barangayError ? (
          <Alert
            tone="danger"
            title="Could not load barangays"
            action={
              <Button variant="secondary" size="sm" onClick={retry}>
                Try again
              </Button>
            }
          >
            {barangayError instanceof ApiError ? barangayError.message : 'Please try again.'}
          </Alert>
        ) : (
          <SelectField
            label="Barangay"
            name="barangay_id"
            required
            disabled={!barangays}
            value={form.barangay_id}
            onChange={(e) => set('barangay_id')(e.target.value)}
            error={errors.barangay_id}
          >
            <option value="">{barangays ? 'Select your barangay' : 'Loading barangays…'}</option>
            {barangays?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectField>
        )}

        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          hint="At least 8 characters. Avoid common passwords."
          required
          value={form.password}
          onChange={(e) => set('password')(e.target.value)}
          error={errors.password}
        />
        <PasswordField
          label="Confirm password"
          name="confirm"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={(e) => set('confirm')(e.target.value)}
          error={errors.confirm}
        />

        <Card flat>
          <details className="r-privacy-details">
            <summary>Read the Privacy Notice</summary>
            <PrivacyNotice />
          </details>
        </Card>
        <CheckboxField
          name="privacy_consent"
          label="I have read the Privacy Notice and agree to the collection and use of my information for disaster reporting."
          checked={form.privacy_consent}
          onChange={(e) => set('privacy_consent')(e.target.checked)}
          error={errors.privacy_consent}
        />

        <Button type="submit" variant="accent" block loading={submitting}>
          Create account
        </Button>
      </form>

      <p className="bcn-muted" style={{ textAlign: 'center' }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
