import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run both built apps against their own API and database:
 *   API 8100 (database beacon_e2e), resident app 4183, MDRRMO console 4184.
 * They never touch the development servers or database.
 */
const DB =
  process.env.E2E_DATABASE_URL ??
  'postgresql+psycopg://beacon:beacon_dev_password@localhost:5432/beacon_e2e';
const API = 'http://localhost:8100';
export const RESIDENT_URL = 'http://localhost:4183';
export const CONSOLE_URL = 'http://localhost:4184';

// Use an already-installed Chromium if one is provided (e.g. in a sandbox).
const executablePath = process.env.E2E_CHROMIUM || undefined;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'resident',
      testMatch: /resident\..*spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: RESIDENT_URL },
    },
    {
      name: 'console',
      testMatch: /console\..*spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: CONSOLE_URL },
    },
  ],
  webServer: [
    {
      command: 'uv run uvicorn app.main:app --port 8100',
      cwd: '../backend',
      url: `${API}/api/v1/health`,
      env: {
        BEACON_DATABASE_URL: DB,
        BEACON_ENVIRONMENT: 'test',
        BEACON_MEDIA_ROOT: './.e2e-media',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @beacon/resident exec vite preview --port 4183 --strictPort',
      cwd: '..',
      url: RESIDENT_URL,
      env: { BEACON_API_URL: API },
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @beacon/mdrrmo exec vite preview --port 4184 --strictPort',
      cwd: '..',
      url: CONSOLE_URL,
      env: { BEACON_API_URL: API },
      reuseExistingServer: false,
    },
  ],
});

export { DB, API };
