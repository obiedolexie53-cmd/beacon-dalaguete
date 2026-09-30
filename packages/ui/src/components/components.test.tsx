import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { REPORT_STATUSES, REPORT_STATUS_LABELS } from '@beacon/shared';
import { Alert } from './Alert';
import { Button } from './Button';
import { DemoBadge } from './Badge';
import { TextField } from './Field';
import { OfflineBanner } from './OfflineBanner';
import { StatusBadge } from './StatusBadge';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Button', () => {
  it('is disabled and busy while loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Submit Report
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Submit Report' });
    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it never submits forms by accident', () => {
    render(<Button>Next</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });
});

describe('StatusBadge', () => {
  it.each(REPORT_STATUSES)('shows the label for %s', (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(REPORT_STATUS_LABELS[status])).toBeTruthy();
  });
});

describe('TextField', () => {
  it('links label, hint and error for assistive technology', () => {
    render(<TextField label="Landmark" hint="e.g. near the chapel" error="Landmark is required" />);
    const input = screen.getByLabelText('Landmark');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const described = describedBy.split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(['e.g. near the chapel', 'Landmark is required']);
  });
});

describe('Alert', () => {
  it('announces errors immediately', () => {
    render(
      <Alert tone="danger" title="Report Not Submitted">
        Please check your connection and try again.
      </Alert>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Report Not Submitted');
  });
});

describe('DemoBadge', () => {
  it('labels demo content', () => {
    render(<DemoBadge />);
    expect(screen.getByText('DEMO DATA')).toBeTruthy();
  });
});

describe('OfflineBanner', () => {
  it('appears when the browser goes offline and hides when back online', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).toBeNull();

    onLine.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('alert').textContent).toContain('No internet connection');

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('PasswordField', () => {
  it('toggles password visibility', async () => {
    const { PasswordField } = await import('./Field');
    render(<PasswordField label="Password" />);
    const input = screen.getByLabelText('Password');
    expect(input.getAttribute('type')).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
  });
});
