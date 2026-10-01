import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DB } from './playwright.config';

/** Fresh end-to-end database with the DEMO accounts, reports and history. */
export default function globalSetup() {
  execFileSync(fileURLToPath(new URL('./scripts/prepare-backend.sh', import.meta.url)), {
    env: { ...process.env, BEACON_DATABASE_URL: DB },
    stdio: 'inherit',
  });
}
