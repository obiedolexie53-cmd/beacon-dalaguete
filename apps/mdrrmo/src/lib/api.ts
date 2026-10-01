import { ApiClient } from '@beacon/shared';

/** The console's API client. Staff auth routes live under /api/v1/staff/auth. */
export const api = new ApiClient({ baseUrl: '/api/v1', authPath: '/staff/auth' });
