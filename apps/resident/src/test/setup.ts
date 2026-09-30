import { afterEach } from 'vitest';
import { configure } from '@testing-library/react';

// Screens wait on (mocked) API calls. A longer async timeout keeps tests stable
// on slow or heavily loaded CI machines.
configure({ asyncUtilTimeout: 3000 });

// Report drafts live in localStorage; start every test with a clean device.
afterEach(() => localStorage.clear());
