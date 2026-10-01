import { ApiClient } from '@beacon/shared';

/** The resident app's API client. Resident auth routes live under /api/v1/auth. */
export const api = new ApiClient({ baseUrl: '/api/v1', authPath: '/auth' });
