/** Base path for the BEACON API. Proxied to the backend in development. */
export const API_BASE = '/api/v1';

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/health`, { signal });
  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}
