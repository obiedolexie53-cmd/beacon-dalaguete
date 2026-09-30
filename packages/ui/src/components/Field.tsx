import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { CircleAlert } from 'lucide-react';

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
      <label className="bcn-field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="bcn-field__required" aria-hidden="true">
            *
          </span>
        )}
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
