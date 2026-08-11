import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.prelaunch.spec.ts',
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5200',
    viewport: { width: 1600, height: 1000 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-prelaunch', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    /* An explicit empty process variable overrides a developer's root `.env`:
       this server proves the exact build shipped before billing opens. */
    command: 'VITE_COMMERCIAL_LAUNCH= pnpm run dev --port 5200',
    url: 'http://localhost:5200',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
