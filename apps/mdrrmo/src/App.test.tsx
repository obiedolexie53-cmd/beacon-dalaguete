import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App scaffold', () => {
  it('renders the heading and shared domain data', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'BEACON MDRRMO Console' })).toBeTruthy();
    expect(screen.getByText('Under Verification')).toBeTruthy();
  });

  it('reports when the API is online', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status: 'ok', service: 'beacon-api', version: '0.1.0' })),
    );
    render(<App />);
    expect(await screen.findByText('Connected to BEACON server')).toBeTruthy();
  });

  it('shows a connection message when the API is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    render(<App />);
    expect(await screen.findByText('Server not reachable.')).toBeTruthy();
  });
});
