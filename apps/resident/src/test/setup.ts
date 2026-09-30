import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';
import { configure } from '@testing-library/react';

// Screens wait on (mocked) API calls. A longer async timeout keeps tests stable
// on slow or heavily loaded CI machines.
configure({ asyncUtilTimeout: 3000 });

// Report drafts live in localStorage; start every test with a clean device.
afterEach(() => localStorage.clear());

// jsdom has no object URLs; previews only need a unique string.
let objectUrlCounter = 0;
vi.stubGlobal(
  'URL',
  Object.assign(URL, {
    createObjectURL: () => `blob:test/${++objectUrlCounter}`,
    revokeObjectURL: () => undefined,
  }),
);
