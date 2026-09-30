import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { CircleAlert, Eye, EyeOff } from 'lucide-react';

interface FieldFrameProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: (ids: { id: string; describedBy?: string }) => ReactNode;
}

function FieldFrame({ label, hint, error, required, children }: FieldFrameProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="bcn-field">
      {/* The required asterisk is drawn in CSS; `required` on the input is what assistive tech announces. */}
      <label
        className={required ? 'bcn-field__label bcn-field__label--required' : 'bcn-field__label'}
        htmlFor={id}
      >
        {label}
      </label>
      {hint && (
        <span id={hintId} className="bcn-field__hint">
          {hint}
        </span>
      )}
      {children({ id, describedBy })}
      {error && (
        <span id={errorId} className="bcn-field__error">
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

type Common = { label: string; hint?: ReactNode; error?: string };

export function TextField({
  label,
  hint,
  error,
  required,
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldFrame label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy }) => (
        <input
          id={id}
          className="bcn-input"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FieldFrame>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldFrame label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          className="bcn-input"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FieldFrame>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldFrame label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy }) => (
        <select
          id={id}
          className="bcn-input"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {children}
        </select>
      )}
    </FieldFrame>
  );
}

/** Password input with a show/hide toggle (helps residents avoid typing mistakes on phones). */
export function PasswordField({
  label,
  hint,
  error,
  required,
  ...rest
}: Common & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <FieldFrame label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy }) => (
        <div className="bcn-password">
          <input
            id={id}
            className="bcn-input"
            type={visible ? 'text' : 'password'}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            autoCapitalize="none"
            spellCheck={false}
            {...rest}
          />
          <button
            type="button"
            className="bcn-password__toggle"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
          >
            {visible ? (
              <EyeOff size={20} aria-hidden="true" />
            ) : (
              <Eye size={20} aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </FieldFrame>
  );
}

export function CheckboxField({
  label,
  error,
  ...rest
}: { label: ReactNode; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="bcn-field">
      <label className="bcn-checkbox" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error && (
        <span id={errorId} className="bcn-field__error">
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}
