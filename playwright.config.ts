import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:3000', channel: 'chrome' },
  projects: [
    { name: 'fidelity', testMatch: 'fidelity/**/*.spec.ts', use: { deviceScaleFactor: 2, viewport: { width: 900, height: 1200 } } },
    { name: 'api', testMatch: 'api/**/*.spec.ts' },
    { name: 'e2e', testMatch: 'e2e/**/*.spec.ts', use: { viewport: { width: 1400, height: 900 } } },
  ],
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
});
