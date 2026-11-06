import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

// The passcode gate: APP_PASSCODE, else .env.local's, else '15'. Global setup and workers inherit it.
if (!process.env.APP_PASSCODE && fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
process.env.APP_PASSCODE ||= '15';

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  globalSetup: './tests/global-setup.ts',
  use: { baseURL: 'http://localhost:3100', channel: 'chrome', storageState: 'tests/.auth/state.json' },
  projects: [
    { name: 'fidelity', testMatch: 'fidelity/**/*.spec.ts', use: { deviceScaleFactor: 2, viewport: { width: 900, height: 1200 } } },
    { name: 'api', testMatch: 'api/**/*.spec.ts' },
    { name: 'e2e', testMatch: 'e2e/**/*.spec.ts', use: { viewport: { width: 1400, height: 900 } } },
  ],
  webServer: { command: 'npm run dev -- -p 3100', url: 'http://localhost:3100/favicon.ico', reuseExistingServer: true, timeout: 120_000,
    env: { APP_PASSCODE: process.env.APP_PASSCODE } },
});
